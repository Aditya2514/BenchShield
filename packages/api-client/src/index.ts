import createClient from 'openapi-fetch';
import type { paths, components } from './schema.js';

export type { paths, components };
export type Schema<T extends keyof components['schemas']> = components['schemas'][T];

// ---------------------------------------------------------------------------
// REST types. All generated from docs/contracts/openapi.json, which the backend
// exports from its FastAPI app (scripts/generate_contracts.py).
// ---------------------------------------------------------------------------
export type ErrorResponse = Schema<'ErrorResponse'>;
export type ErrorDetail = Schema<'ErrorDetail'>;

export type ItemIntake = Schema<'ItemIntake'>;
export type ChoiceOption = Schema<'ChoiceOption'>;
export type TaskType = Schema<'TaskType'>;
export type BenchmarkImportRequest = Schema<'BenchmarkImportRequest'>;
export type BenchmarkImportResponse = Schema<'BenchmarkImportResponse'>;
export type ImportRowError = Schema<'ImportRowError'>;
export type BenchmarkVersion = Schema<'BenchmarkVersion'>;
export type ItemVersion = Schema<'ItemVersion'>;
export type ItemVersionListResponse = Schema<'ItemVersionListResponse'>;

export type SourceFamily = Schema<'SourceFamily'>;
export type EvaluationPolicyCreateRequest = Schema<'EvaluationPolicyCreateRequest'>;
export type EvaluationPolicyVersion = Schema<'EvaluationPolicyVersion'>;

export type InvestigationStatus = Schema<'InvestigationStatus'>;
export type InvestigationCreateRequest = Schema<'InvestigationCreateRequest'>;
export type InvestigationStatusResponse = Schema<'InvestigationStatusResponse'>;
export type InvestigationBudgets = Schema<'InvestigationBudgets'>;
export type InvestigationLimitations = Schema<'InvestigationLimitations'>;
export type InvestigationCancelRequest = Schema<'InvestigationCancelRequest'>;
export type InvestigationCancelResponse = Schema<'InvestigationCancelResponse'>;

export type ClaimStatus = Schema<'ClaimStatus'>;
export type ExposureType = Schema<'ExposureType'>;
export type TaskIdentity = Schema<'TaskIdentity'>;
export type AnswerMatch = Schema<'AnswerMatch'>;
export type TemporalStatus = Schema<'TemporalStatus'>;
export type FindingView = Schema<'FindingView'>;
export type FindingListResponse = Schema<'FindingListResponse'>;
export type VerificationRunResponse = Schema<'VerificationRunResponse'>;

export type ReviewAction = Schema<'ReviewAction'>;
export type ReviewCreateRequest = Schema<'ReviewCreateRequest'>;
export type ReviewDecision = Schema<'ReviewDecision'>;
export type ReviewHistoryResponse = Schema<'ReviewHistoryResponse'>;

export type ReportStatus = Schema<'ReportStatus'>;
export type ReportCreateRequest = Schema<'ReportCreateRequest'>;
export type ReportStatusResponse = Schema<'ReportStatusResponse'>;

export type ExperimentCondition = Schema<'ExperimentCondition'>;
export type ExperimentCreateRequest = Schema<'ExperimentCreateRequest'>;
export type ExperimentConfig = Schema<'ExperimentConfig'>;

// ---------------------------------------------------------------------------
// Server-Sent Events. Mirrors docs/contracts/events/sse_envelope.json.
// The backend frames each event as `id: <seq>\nevent: <type>\ndata: <payload>`,
// where <payload> is the typed payload object below (not the full envelope).
// tests/contract-safety.test.ts checks this list against the schema.
// ---------------------------------------------------------------------------
export const EVENT_TYPES = [
  'investigation_queued',
  'investigation_started',
  'phase_transition',
  'item_investigation_started',
  'candidate_discovered',
  'verification_completed',
  'budget_updated',
  'investigation_completed',
  'investigation_failed',
  'investigation_cancelled',
  'investigation_blocked',
  'snapshot_refresh_required',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface EventPayloads {
  investigation_queued: { benchmark_version_id: string; policy_version_id: string; total_items: number };
  investigation_started: { benchmark_version_id: string; total_items: number };
  phase_transition: { from_phase: string; to_phase: string };
  item_investigation_started: { item_version_id: string; external_id: string; item_index: number };
  candidate_discovered: {
    item_version_id: string;
    external_id: string;
    source_url: string;
    source_family: SourceFamily;
  };
  verification_completed: {
    item_version_id: string;
    external_id: string;
    exposure_type: ExposureType;
    claim_status: ClaimStatus;
    task_identity: TaskIdentity;
    answer_match: AnswerMatch;
    temporal_status: TemporalStatus;
  };
  budget_updated: {
    used_queries: number;
    max_queries: number;
    used_fetches: number;
    max_fetches: number;
    used_cost_usd: number;
    cost_ceiling_usd: number;
  };
  investigation_completed: {
    status: InvestigationStatus;
    total_items: number;
    investigated_items: number;
    findings_count: number;
    is_partial: boolean;
  };
  investigation_failed: { failure_code: string; message: string };
  investigation_cancelled: { cancelled_at: string; reason: string };
  investigation_blocked: { reason: string };
  snapshot_refresh_required: { last_known_event_id: string; investigation_id: string; message?: string };
}

/** One parsed SSE frame. `id` is the backend's monotonic sequence number. */
export type InvestigationEvent = {
  [K in EventType]: { id: string; type: K; data: EventPayloads[K] };
}[EventType];

export function createApiClient(baseUrl: string = '', options?: RequestInit) {
  return createClient<paths>({
    baseUrl,
    ...options,
  });
}
