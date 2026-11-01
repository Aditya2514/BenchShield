import type { EvaluationPolicyVersion, ReportStatusResponse } from '@benchshield/api-client';

/** A benchmark version accepted by the backend. Holds IDs and counts only. */
export interface StagedBenchmark {
  benchmark_id: string | null;
  benchmark_version_id: string;
  name: string;
  total_rows: number;
  valid_rows: number;
}

/**
 * The audit the user is working on. The backend has no "list" endpoints yet,
 * so the frontend remembers the IDs it created. Contains no benchmark content.
 */
export interface Workflow {
  benchmark: StagedBenchmark | null;
  policy: EvaluationPolicyVersion | null;
  investigationId: string | null;
  report: ReportStatusResponse | null;
}

export const EMPTY_WORKFLOW: Workflow = { benchmark: null, policy: null, investigationId: null, report: null };

const KEY = 'benchshield.workflow';

export function loadWorkflow(): Workflow {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? { ...EMPTY_WORKFLOW, ...(JSON.parse(raw) as Workflow) } : EMPTY_WORKFLOW;
  } catch {
    return EMPTY_WORKFLOW;
  }
}

export function saveWorkflow(w: Workflow): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    // ignore storage failures
  }
}
