import scenario1 from '../../../../fixtures/scenarios/1-successful-audit.json';
import scenario2 from '../../../../fixtures/scenarios/2-partial-coverage-outage.json';
import scenario3 from '../../../../fixtures/scenarios/3-policy-blocked.json';
import scenario4 from '../../../../fixtures/scenarios/4-failed-audit.json';
import scenario5 from '../../../../fixtures/scenarios/5-report-generation-failure.json';

export interface ScenarioData {
  scenario_id: string;
  name: string;
  description: string;
  investigation: any;
  findings: any[];
  report: any;
  events: any[];
}

export const SCENARIOS: Record<string, ScenarioData> = {
  '1-successful-audit': scenario1 as ScenarioData,
  '2-partial-coverage-outage': scenario2 as ScenarioData,
  '3-policy-blocked': scenario3 as ScenarioData,
  '4-failed-audit': scenario4 as ScenarioData,
  '5-report-generation-failure': scenario5 as ScenarioData,
};

let currentScenarioId: string = '1-successful-audit';
let currentFindings = JSON.parse(JSON.stringify(SCENARIOS['1-successful-audit'].findings));

export function getActiveScenario(): ScenarioData {
  const scenario = SCENARIOS[currentScenarioId] || SCENARIOS['1-successful-audit'];
  return {
    ...scenario,
    findings: currentFindings,
  };
}

export function setActiveScenario(scenarioId: string) {
  if (SCENARIOS[scenarioId]) {
    currentScenarioId = scenarioId;
    currentFindings = JSON.parse(JSON.stringify(SCENARIOS[scenarioId].findings));
  }
}

export function getActiveFindings() {
  return currentFindings;
}

export function updateFindingReview(findingId: string, action: string, reason: string, reviewerId: string, expectedVersion: number) {
  const findingIndex = currentFindings.findIndex((f: any) => f.id === findingId);
  if (findingIndex === -1) {
    return { error: 'not_found', status: 404 };
  }

  const finding = currentFindings[findingIndex];
  if (finding.version !== expectedVersion) {
    return { error: 'version_conflict', status: 409 };
  }

  finding.review_decision = {
    action,
    reason,
    reviewed_at: new Date().toISOString(),
    reviewer_id: reviewerId,
  };
  finding.claim_status = action === 'confirmed' ? 'verified' : action === 'rejected' ? 'rejected' : 'needs_review';
  finding.version += 1;

  return { finding, status: 200 };
}

