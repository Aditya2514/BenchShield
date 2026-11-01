import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(__dirname, '../../..');
const openapi = JSON.parse(fs.readFileSync(path.join(root, 'docs/contracts/openapi.json'), 'utf-8'));
const sse = JSON.parse(fs.readFileSync(path.join(root, 'docs/contracts/events/sse_envelope.json'), 'utf-8'));
const scenariosDir = path.join(root, 'fixtures/scenarios');

// Ajv understands the OpenAPI 3.1 component schemas directly (they are JSON Schema 2020-12).
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: 'openapi', components: openapi.components });
ajv.addSchema({ $id: 'sse', $defs: sse.$defs });

const component = (name: string) => ajv.getSchema(`openapi#/components/schemas/${name}`)!;
const payloadSchemaFor: Record<string, string> = {
  investigation_queued: 'InvestigationQueuedPayload',
  investigation_started: 'InvestigationStartedPayload',
  phase_transition: 'PhaseTransitionPayload',
  item_investigation_started: 'ItemInvestigationStartedPayload',
  candidate_discovered: 'CandidateDiscoveredPayload',
  verification_completed: 'VerificationCompletedPayload',
  budget_updated: 'BudgetUpdatedPayload',
  investigation_completed: 'InvestigationCompletedPayload',
  investigation_failed: 'InvestigationFailedPayload',
  investigation_cancelled: 'InvestigationCancelledPayload',
  investigation_blocked: 'InvestigationBlockedPayload',
  snapshot_refresh_required: 'SnapshotRefreshRequiredPayload',
};

function expectValid(schemaName: string, value: unknown, where: string) {
  const validate = component(schemaName);
  const ok = validate(value);
  if (!ok) console.error(where, JSON.stringify(validate.errors, null, 2));
  expect(ok, `${where} should match ${schemaName}`).toBe(true);
}

const scenarioFiles = fs.readdirSync(scenariosDir).filter((f) => f.endsWith('.json')).sort();

describe('Mock scenarios match the backend contract', () => {
  it('has the five documented scenarios', () => {
    expect(scenarioFiles).toEqual([
      '1-successful-audit.json',
      '2-partial-coverage-outage.json',
      '3-policy-blocked.json',
      '4-failed-audit.json',
      '5-report-generation-failure.json',
    ]);
  });

  for (const filename of scenarioFiles) {
    describe(filename, () => {
      const s = JSON.parse(fs.readFileSync(path.join(scenariosDir, filename), 'utf-8'));

      it('investigation, policy and import responses match their schemas', () => {
        expectValid('InvestigationStatusResponse', s.investigation, 'investigation');
        expectValid('EvaluationPolicyVersion', s.policy, 'policy');
        expectValid('BenchmarkImportResponse', s.benchmark_import, 'benchmark_import');
      });

      it('every finding matches FindingView and belongs to the investigation', () => {
        for (const f of s.findings) {
          expectValid('FindingView', f, `finding ${f.finding_id}`);
          expect(f.investigation_id).toBe(s.investigation.investigation_id);
        }
      });

      it('report and review history match their schemas', () => {
        if (s.report) expectValid('ReportStatusResponse', s.report, 'report');
        for (const decisions of Object.values(s.review_history as Record<string, unknown[]>)) {
          for (const d of decisions) expectValid('ReviewDecision', d, 'review decision');
        }
      });

      it('events are monotonic and each payload matches its typed schema', () => {
        let last = 0;
        for (const e of s.events) {
          expect(Number(e.id)).toBeGreaterThan(last);
          last = Number(e.id);
          const validate = ajv.getSchema(`sse#/$defs/${payloadSchemaFor[e.type]}`);
          expect(validate, `unknown event type ${e.type}`).toBeDefined();
          const ok = validate!(e.data);
          if (!ok) console.error(filename, e, validate!.errors);
          expect(ok).toBe(true);
        }
      });

      it('contains no gold answers', () => {
        const text = JSON.stringify(s);
        expect(text).not.toContain('gold_answer');
        for (const gold of ['Sub-surface thorium reactor', 'Vellan Stream']) expect(text).not.toContain(gold);
      });
    });
  }
});
