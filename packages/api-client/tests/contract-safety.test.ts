import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const openApiPath = path.resolve(__dirname, '../../../docs/contracts/openapi.yaml');
const eventsSchemaPath = path.resolve(__dirname, '../../../docs/contracts/events.schema.json');

const FORBIDDEN_PROPERTY_NAMES = [
  'gold_answer',
  'protected_answer',
  'ground_truth_answer',
  'gold_solution',
  'answer_key_content',
];

/**
 * Recursively inspects only property names defined in response schemas.
 */
function checkPropertyNamesForGoldLeaks(schema: unknown, pathTrail: string[] = []): string[] {
  const violations: string[] = [];
  if (!schema || typeof schema !== 'object') {
    return violations;
  }

  const obj = schema as Record<string, unknown>;

  if (obj.properties && typeof obj.properties === 'object') {
    for (const propName of Object.keys(obj.properties)) {
      if (FORBIDDEN_PROPERTY_NAMES.includes(propName.toLowerCase())) {
        violations.push(`${pathTrail.join('.')}.${propName}`);
      }
      violations.push(...checkPropertyNamesForGoldLeaks((obj.properties as Record<string, unknown>)[propName], [...pathTrail, propName]));
    }
  }

  if (obj.items && typeof obj.items === 'object') {
    violations.push(...checkPropertyNamesForGoldLeaks(obj.items, [...pathTrail, '[]']));
  }

  if (Array.isArray(obj.allOf)) {
    obj.allOf.forEach((sub, i) => violations.push(...checkPropertyNamesForGoldLeaks(sub, [...pathTrail, `allOf[${i}]`])));
  }
  if (Array.isArray(obj.anyOf)) {
    obj.anyOf.forEach((sub, i) => violations.push(...checkPropertyNamesForGoldLeaks(sub, [...pathTrail, `anyOf[${i}]`])));
  }
  if (Array.isArray(obj.oneOf)) {
    obj.oneOf.forEach((sub, i) => violations.push(...checkPropertyNamesForGoldLeaks(sub, [...pathTrail, `oneOf[${i}]`])));
  }

  return violations;
}

describe('Contract Safety Checks', () => {
  it('ensures no API response schema exposes protected/gold answer property names', () => {
    const rawYaml = fs.readFileSync(openApiPath, 'utf-8');
    const openapi = YAML.parse(rawYaml);

    const violations: string[] = [];

    // Traverse all response schemas across all endpoints
    const paths = openapi.paths || {};
    for (const [endpoint, methods] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(methods as Record<string, any>)) {
        if (!op || typeof op !== 'object' || !op.responses) continue;

        for (const [status, resp] of Object.entries(op.responses as Record<string, any>)) {
          const content = resp?.content?.['application/json'];
          if (content?.schema) {
            const pathInfo = `${method.toUpperCase()} ${endpoint} -> ${status}`;
            const leaks = checkPropertyNamesForGoldLeaks(content.schema, [pathInfo]);
            violations.push(...leaks);
          }
        }
      }
    }

    // Also check components.schemas for response objects
    const schemas = openapi.components?.schemas || {};
    for (const [name, schema] of Object.entries(schemas)) {
      // Exclude BenchmarkImportRequest which is a request body schema
      if (name === 'BenchmarkImportRequest') continue;

      const leaks = checkPropertyNamesForGoldLeaks(schema, [`components.schemas.${name}`]);
      violations.push(...leaks);
    }

    expect(violations).toEqual([]);
  });

  it('negative test: catches response schemas that define a forbidden gold property', () => {
    const dummyLeakySchema = {
      type: 'object',
      properties: {
        item_id: { type: 'string' },
        gold_answer: { type: 'string' },
      },
    };

    const leaks = checkPropertyNamesForGoldLeaks(dummyLeakySchema, ['DUMMY_LEAKY_RESPONSE']);
    expect(leaks).toContain('DUMMY_LEAKY_RESPONSE.gold_answer');
  });

  it('permits valid exposure type enum values like reference_answer', () => {
    const dummyValidSchema = {
      type: 'object',
      properties: {
        exposure_dimension: {
          type: 'string',
          enum: ['metadata', 'question_context', 'worked_solution', 'reference_answer'],
        },
      },
    };

    const leaks = checkPropertyNamesForGoldLeaks(dummyValidSchema, ['DUMMY_VALID_RESPONSE']);
    expect(leaks).toHaveLength(0);
  });

  it('verifies events.schema.json requires monotonic event_id, entity_id, type, schema_version, time', () => {
    const rawJson = fs.readFileSync(eventsSchemaPath, 'utf-8');
    const schema = JSON.parse(rawJson);

    expect(schema.required).toContain('event_id');
    expect(schema.required).toContain('entity_id');
    expect(schema.required).toContain('type');
    expect(schema.required).toContain('schema_version');
    expect(schema.required).toContain('time');
  });
});

