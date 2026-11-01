import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EVENT_TYPES } from '../src/index.js';

const contractsDir = path.resolve(__dirname, '../../../docs/contracts');
const openapi = JSON.parse(fs.readFileSync(path.join(contractsDir, 'openapi.json'), 'utf-8'));
const sseEnvelope = JSON.parse(fs.readFileSync(path.join(contractsDir, 'events/sse_envelope.json'), 'utf-8'));

const FORBIDDEN_PROPERTY_NAMES = [
  'gold_answer',
  'protected_answer',
  'ground_truth_answer',
  'gold_solution',
  'answer_key_content',
];

// Request-only schemas legitimately carry the gold answer into the vault.
const REQUEST_ONLY_SCHEMAS = new Set(['BenchmarkImportRequest', 'ItemIntake']);

/** Recursively collects forbidden property names, following local $refs. */
function findGoldLeaks(schema: unknown, trail: string[], seen = new Set<string>()): string[] {
  if (!schema || typeof schema !== 'object') return [];
  const obj = schema as Record<string, unknown>;
  const out: string[] = [];

  if (typeof obj.$ref === 'string') {
    const name = obj.$ref.split('/').pop()!;
    if (REQUEST_ONLY_SCHEMAS.has(name) || seen.has(name)) return out;
    seen.add(name);
    return findGoldLeaks(openapi.components.schemas[name], [...trail, name], seen);
  }
  if (obj.properties && typeof obj.properties === 'object') {
    for (const [prop, sub] of Object.entries(obj.properties as Record<string, unknown>)) {
      if (FORBIDDEN_PROPERTY_NAMES.includes(prop.toLowerCase())) out.push([...trail, prop].join('.'));
      out.push(...findGoldLeaks(sub, [...trail, prop], seen));
    }
  }
  if (obj.items) out.push(...findGoldLeaks(obj.items, [...trail, '[]'], seen));
  for (const key of ['allOf', 'anyOf', 'oneOf'] as const) {
    const list = obj[key];
    if (Array.isArray(list)) list.forEach((sub, i) => out.push(...findGoldLeaks(sub, [...trail, `${key}[${i}]`], seen)));
  }
  return out;
}

describe('Contract safety (backend-generated openapi.json)', () => {
  it('no API response schema exposes a protected/gold answer property', () => {
    const violations: string[] = [];
    for (const [endpoint, methods] of Object.entries(openapi.paths as Record<string, Record<string, any>>)) {
      for (const [method, op] of Object.entries(methods)) {
        for (const [code, resp] of Object.entries((op?.responses ?? {}) as Record<string, any>)) {
          const schema = resp?.content?.['application/json']?.schema;
          if (schema) violations.push(...findGoldLeaks(schema, [`${method.toUpperCase()} ${endpoint} ${code}`]));
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('negative test: detects a forbidden gold property', () => {
    const leaky = { type: 'object', properties: { item_id: { type: 'string' }, gold_answer: { type: 'string' } } };
    expect(findGoldLeaks(leaky, ['DUMMY'])).toContain('DUMMY.gold_answer');
  });

  it('every path the frontend calls exists in the contract', () => {
    const used = [
      'post /api/v1/benchmarks',
      'post /api/v1/benchmarks/upload',
      'post /api/v1/policies',
      'post /api/v1/investigations',
      'get /api/v1/investigations/{investigation_id}',
      'get /api/v1/investigations/{investigation_id}/events',
      'post /api/v1/investigations/{investigation_id}/cancel',
      'post /api/v1/investigations/{investigation_id}/verify',
      'get /api/v1/investigations/{investigation_id}/findings',
      'get /api/v1/findings/{finding_id}',
      'get /api/v1/findings/{finding_id}/reviews',
      'post /api/v1/findings/{finding_id}/reviews',
      'post /api/v1/investigations/{investigation_id}/experiments',
      'post /api/v1/investigations/{investigation_id}/reports',
      'get /api/v1/reports/{report_id}/download',
    ];
    const missing = used.filter((u) => {
      const [method, p] = u.split(' ');
      return !openapi.paths[p]?.[method];
    });
    expect(missing).toEqual([]);
  });

  it('SSE envelope requires id, investigation, type and data', () => {
    expect(sseEnvelope.required).toEqual(
      expect.arrayContaining(['event_id', 'investigation_id', 'type', 'data'])
    );
  });

  it('client EVENT_TYPES match the backend EventType enum exactly', () => {
    expect([...EVENT_TYPES].sort()).toEqual([...sseEnvelope.$defs.EventType.enum].sort());
  });

  it('no SSE event payload exposes a gold answer property', () => {
    const leaks = Object.entries(sseEnvelope.$defs as Record<string, any>)
      .filter(([name]) => name.endsWith('Payload'))
      .flatMap(([name, schema]) => findGoldLeaks(schema, [name]));
    expect(leaks).toEqual([]);
  });
});
