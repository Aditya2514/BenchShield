/**
 * Mock scenarios for demo mode and tests.
 *
 * Every fixture in fixtures/scenarios was captured from (or derived field-by-
 * field from) the real backend, and packages/api-client/tests validates each
 * one against docs/contracts/openapi.json. Nothing here is a hand-invented shape.
 */
import type {
  BenchmarkImportResponse,
  EvaluationPolicyVersion,
  FindingView,
  InvestigationEvent,
  InvestigationStatusResponse,
  ReportStatusResponse,
  ReviewDecision,
} from '@benchshield/api-client';
import scenario1 from '../../../../fixtures/scenarios/1-successful-audit.json';
import scenario2 from '../../../../fixtures/scenarios/2-partial-coverage-outage.json';
import scenario3 from '../../../../fixtures/scenarios/3-policy-blocked.json';
import scenario4 from '../../../../fixtures/scenarios/4-failed-audit.json';
import scenario5 from '../../../../fixtures/scenarios/5-report-generation-failure.json';

export interface ScenarioData {
  scenario_id: string;
  name: string;
  description: string;
  investigation: InvestigationStatusResponse;
  findings: FindingView[];
  report: ReportStatusResponse | null;
  report_download: Record<string, unknown> | null;
  events: InvestigationEvent[];
  review_history: Record<string, ReviewDecision[]>;
  policy: EvaluationPolicyVersion;
  benchmark_import: BenchmarkImportResponse;
}

export const SCENARIOS: Record<string, ScenarioData> = Object.fromEntries(
  [scenario1, scenario2, scenario3, scenario4, scenario5].map((s) => [s.scenario_id, s as unknown as ScenarioData])
);

export const DEFAULT_SCENARIO_ID = '1-successful-audit';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

interface MockInvestigation {
  investigation: InvestigationStatusResponse;
  findings: FindingView[];
  events: InvestigationEvent[];
  /** Verification events and findings are released by POST /verify (like the backend). */
  pendingVerification: { events: InvestigationEvent[]; findings: FindingView[] } | null;
  /** Discovery events not yet streamed (new launches only). */
  pendingDiscovery: boolean;
}

/** In-memory state behind the MSW handlers. Reset per test. */
export const mockDb = {
  investigations: new Map<string, MockInvestigation>(),
  findingIndex: new Map<string, string>(),
  reviews: new Map<string, ReviewDecision[]>(),
  reports: new Map<string, { status: ReportStatusResponse; content: Record<string, unknown> | null }>(),
  failNextRequestWith401: false,
  counter: 0,
};

function register(inv: MockInvestigation) {
  mockDb.investigations.set(inv.investigation.investigation_id, inv);
  for (const f of [...inv.findings, ...(inv.pendingVerification?.findings ?? [])]) {
    mockDb.findingIndex.set(f.finding_id, inv.investigation.investigation_id);
  }
}

export function resetMockDb() {
  mockDb.investigations.clear();
  mockDb.findingIndex.clear();
  mockDb.reviews.clear();
  mockDb.reports.clear();
  mockDb.failNextRequestWith401 = false;
  mockDb.counter = 0;
  for (const s of Object.values(SCENARIOS)) {
    const data = clone(s);
    register({
      investigation: data.investigation,
      findings: data.findings,
      events: data.events,
      pendingVerification: null,
      pendingDiscovery: false,
    });
    for (const [fid, decisions] of Object.entries(data.review_history)) mockDb.reviews.set(fid, decisions);
    if (data.report) {
      mockDb.reports.set(data.report.report_id, { status: data.report, content: data.report_download });
    }
  }
}

/** Simulates a new run by replaying scenario 1 under a fresh investigation id. */
export function createMockRun(benchmarkVersionId: string, policyVersionId: string): InvestigationStatusResponse {
  const base = clone(SCENARIOS[DEFAULT_SCENARIO_ID]);
  const oldId = base.investigation.investigation_id;
  const newId = `inv_mock_${++mockDb.counter}`;
  const swap = <T,>(v: T): T =>
    JSON.parse(
      JSON.stringify(v)
        .split(oldId).join(newId)
        .split(base.policy.policy_version_id).join(policyVersionId)
        .split(base.benchmark_import.benchmark_version_id ?? '__none__').join(benchmarkVersionId)
    );
  const now = new Date().toISOString();
  const findings = swap(base.findings).map((f) => ({
    ...f,
    finding_id: `${f.finding_id}_${mockDb.counter}`,
    version: 1,
    current_reviewer_decision: null,
  }));
  const allEvents = swap(base.events);
  const investigation: InvestigationStatusResponse = {
    ...swap(base.investigation),
    status: 'queued',
    investigated_items: 0,
    findings_count: 0,
    budgets: { ...base.investigation.budgets, used_queries: 0, used_fetches: 0, used_cost_usd: 0 },
    created_at: now,
    updated_at: now,
  };
  register({
    investigation,
    findings: [],
    events: allEvents.filter((e) => e.type !== 'verification_completed'),
    pendingVerification: {
      events: allEvents.filter((e) => e.type === 'verification_completed'),
      findings,
    },
    pendingDiscovery: true,
  });
  return investigation;
}

resetMockDb();

export const mockKit = {
  scenarios: SCENARIOS,
  defaultScenarioId: DEFAULT_SCENARIO_ID,
  simulateExpiry: () => {
    mockDb.failNextRequestWith401 = true;
  },
};
