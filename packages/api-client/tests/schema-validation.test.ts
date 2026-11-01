import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const eventsSchemaPath = path.resolve(__dirname, '../../../docs/contracts/events.schema.json');
const scenariosDir = path.resolve(__dirname, '../../../fixtures/scenarios');

describe('Synthetic Scenario & Event Schema Validation', () => {
  const ajv = new Ajv2020({ strict: false });
  const eventsSchema = JSON.parse(fs.readFileSync(eventsSchemaPath, 'utf-8'));
  const validateEvent = ajv.compile(eventsSchema);

  const scenarioFiles = [
    '1-successful-audit.json',
    '2-partial-coverage-outage.json',
    '3-policy-blocked.json',
    '4-failed-audit.json',
    '5-report-generation-failure.json',
  ];

  for (const filename of scenarioFiles) {
    it(`validates scenario ${filename} structure and its ordered SSE events`, () => {
      const filePath = path.join(scenariosDir, filename);
      expect(fs.existsSync(filePath)).toBe(true);

      const scenario = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      expect(scenario.scenario_id).toBeDefined();
      expect(scenario.investigation).toBeDefined();
      expect(Array.isArray(scenario.findings)).toBe(true);
      expect(Array.isArray(scenario.events)).toBe(true);

      // Validate each event against events.schema.json
      for (const event of scenario.events) {
        const isValid = validateEvent(event);
        if (!isValid) {
          console.error(`Event validation errors for ${filename}:`, validateEvent.errors);
        }
        expect(isValid).toBe(true);
        expect(event.event_id).toBeDefined();
        expect(event.entity_id).toBeDefined();
        expect(event.type).toBeDefined();
        expect(event.schema_version).toBe('1.0.0');
        expect(event.time).toBeDefined();
      }
    });
  }
});

