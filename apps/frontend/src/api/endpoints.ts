import type {
  BenchmarkImportResponse,
  EvaluationPolicyCreateRequest,
  EvaluationPolicyVersion,
  ExperimentConfig,
  ExperimentCreateRequest,
  FindingListResponse,
  FindingView,
  InvestigationCancelResponse,
  InvestigationStatusResponse,
  ReportStatusResponse,
  ReviewCreateRequest,
  ReviewDecision,
  ReviewHistoryResponse,
  VerificationRunResponse,
  ClaimStatus,
  ExposureType,
  TemporalStatus,
} from '@benchshield/api-client';
import { getSession, newIdempotencyKey, rawRequest, request } from './http.js';

const API = '/api/v1';
const enc = encodeURIComponent;

/**
 * Uploads benchmark content as a file. The backend parses CSV or JSON and
 * returns per-row errors (status "rejected") without echoing gold answers.
 */
export function uploadBenchmark(name: string, format: 'json' | 'csv', content: string) {
  // Multipart body built by hand: identical on the wire to FormData, and works
  // in every fetch implementation (jsdom's FormData does not, under Node fetch).
  const boundary = `----benchshield${Math.random().toString(16).slice(2)}`;
  const type = format === 'csv' ? 'text/csv' : 'application/json';
  const body =
    `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="benchmark.${format}"\r\n` +
    `Content-Type: ${type}\r\n\r\n${content}\r\n--${boundary}--\r\n`;
  return request<BenchmarkImportResponse>(`${API}/benchmarks/upload`, {
    method: 'POST',
    body,
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Idempotency-Key': newIdempotencyKey('import') },
  });
}

export function createPolicy(payload: EvaluationPolicyCreateRequest) {
  return request<EvaluationPolicyVersion>(`${API}/policies`, { method: 'POST', json: payload });
}

export function launchInvestigation(benchmarkVersionId: string, policyVersionId: string, idempotencyKey: string) {
  return request<InvestigationStatusResponse>(`${API}/investigations`, {
    method: 'POST',
    json: {
      workspace_id: getSession()?.workspaceId ?? '',
      benchmark_version_id: benchmarkVersionId,
      policy_version_id: policyVersionId,
    },
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export function getInvestigation(id: string, signal?: AbortSignal) {
  return request<InvestigationStatusResponse>(`${API}/investigations/${enc(id)}`, { signal });
}

export function cancelInvestigation(id: string, reason: string) {
  return request<InvestigationCancelResponse>(`${API}/investigations/${enc(id)}/cancel`, {
    method: 'POST',
    json: { reason },
    headers: { 'Idempotency-Key': newIdempotencyKey('cancel') },
  });
}

export function verifyInvestigation(id: string) {
  return request<VerificationRunResponse>(`${API}/investigations/${enc(id)}/verify`, { method: 'POST' });
}

export interface FindingFilters {
  exposure_type?: ExposureType;
  claim_status?: ClaimStatus;
  temporal_status?: TemporalStatus;
}

export function listFindings(id: string, filters: FindingFilters = {}, page = 1, size = 100) {
  return request<FindingListResponse>(`${API}/investigations/${enc(id)}/findings`, {
    query: { page, size, ...filters },
  });
}

export function getFinding(id: string) {
  return request<FindingView>(`${API}/findings/${enc(id)}`);
}

export function getReviewHistory(id: string) {
  return request<ReviewHistoryResponse>(`${API}/findings/${enc(id)}/reviews`);
}

export function submitReview(id: string, payload: ReviewCreateRequest) {
  return request<ReviewDecision>(`${API}/findings/${enc(id)}/reviews`, { method: 'POST', json: payload });
}

export function launchExperiment(investigationId: string, payload: ExperimentCreateRequest) {
  return request<ExperimentConfig>(`${API}/investigations/${enc(investigationId)}/experiments`, {
    method: 'POST',
    json: payload,
  });
}

export function createReport(investigationId: string) {
  return request<ReportStatusResponse>(`${API}/investigations/${enc(investigationId)}/reports`, {
    method: 'POST',
    json: { investigation_id: investigationId },
  });
}

export function getReport(reportId: string) {
  return request<ReportStatusResponse>(`${API}/reports/${enc(reportId)}`);
}

/** The frozen report body. Its shape is not part of the OpenAPI contract yet. */
export interface FrozenReport {
  report_id: string;
  report_version: string;
  investigation_id: string;
  frozen_at: string;
  content_sha256: string;
  limitations: string[];
  items_with_verified_exposure: string[];
  summary_counts: Record<string, number>;
  scope?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Download URLs need the auth headers, so they are fetched rather than opened. */
export async function fetchReportContent(downloadUrl: string): Promise<{ data: FrozenReport; raw: Blob }> {
  const res = await rawRequest(downloadUrl);
  const raw = await res.blob();
  return { data: JSON.parse(await raw.text()) as FrozenReport, raw };
}

export function saveBlob(blob: Blob, filename: string): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
