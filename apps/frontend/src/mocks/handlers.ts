/**
 * MSW handlers that follow the backend contract (docs/contracts/openapi.json):
 * same paths, auth headers, status codes, error bodies and SSE framing.
 */
import { http, HttpResponse } from 'msw';
import type {
  ErrorResponse,
  EvaluationPolicyCreateRequest,
  EvaluationPolicyVersion,
  InvestigationEvent,
  ReportStatusResponse,
  ReviewAction,
  ReviewCreateRequest,
  ReviewDecision,
} from '@benchshield/api-client';
import { SCENARIOS, DEFAULT_SCENARIO_ID, createMockRun, mockDb } from './scenarios.js';

const API = '/api/v1';
const REVIEW_TO_CLAIM: Record<ReviewAction, 'verified' | 'rejected' | 'needs_review'> = {
  confirm: 'verified',
  reject: 'rejected',
  request_more_evidence: 'needs_review',
};

function error(status: number, code: ErrorResponse['error'], message: string, details: ErrorResponse['details'] = []) {
  const body: ErrorResponse = {
    error: code,
    message,
    details,
    request_id: `req_mock_${Date.now().toString(16)}`,
    timestamp: new Date().toISOString(),
  };
  return HttpResponse.json(body, { status });
}

/** Mirrors the backend's auth dependency: bearer token + X-Workspace-ID. */
function authFailure(request: Request) {
  if (mockDb.failNextRequestWith401) {
    mockDb.failNextRequestWith401 = false;
    return error(401, 'forbidden', 'Authentication token has expired.');
  }
  if (!request.headers.get('authorization')?.startsWith('Bearer ')) {
    return error(401, 'forbidden', "Missing or malformed Authorization header. Expected 'Bearer <token>'.");
  }
  if (!request.headers.get('x-workspace-id')) {
    return error(400, 'validation_failed', 'X-Workspace-ID header is required for tenant-scoped operations.');
  }
  return null;
}

const SUPPORTED_TASK_TYPES = new Set(['exact_short_answer', 'multiple_choice']);

function validateRows(rows: Record<string, unknown>[]) {
  const errors: { row_number: number; field: string; error_code: string; message: string }[] = [];
  const seen = new Map<string, number>();
  rows.forEach((row, i) => {
    const n = i + 1;
    const id = String(row.external_id ?? '').trim();
    if (!id) errors.push({ row_number: n, field: 'external_id', error_code: 'missing_required_field', message: 'External item ID is required.' });
    else if (seen.has(id)) errors.push({ row_number: n, field: 'external_id', error_code: 'duplicate_item_id', message: `Duplicate external item ID '${id}' (first seen at row ${seen.get(id)}).` });
    else seen.set(id, n);
    if (!String(row.question ?? '').trim()) errors.push({ row_number: n, field: 'question', error_code: 'missing_required_field', message: 'Question text is required and cannot be empty.' });
    if (!String(row.gold_answer ?? '').trim()) errors.push({ row_number: n, field: 'gold_answer', error_code: 'missing_required_field', message: 'Gold answer is required and cannot be empty.' });
    const t = String(row.task_type ?? '');
    if (!SUPPORTED_TASK_TYPES.has(t)) errors.push({ row_number: n, field: 'task_type', error_code: 'unsupported_task_type', message: `Task type '${t}' is unsupported. Supported types are 'exact_short_answer' and 'multiple_choice'.` });
  });
  return errors;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim()));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

function sseResponse(frames: InvestigationEvent[], onDone?: () => void) {
  const encoder = new TextEncoder();
  const delayMs = import.meta.env.MODE === 'test' ? 0 : 120;
  const stream = new ReadableStream({
    async start(controller) {
      for (const e of frames) {
        controller.enqueue(encoder.encode(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`));
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      }
      onDone?.();
      controller.close();
    },
  });
  return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

function getRun(id: string) {
  return mockDb.investigations.get(id);
}

function findFinding(findingId: string) {
  const invId = mockDb.findingIndex.get(findingId);
  const run = invId ? getRun(invId) : undefined;
  const finding = run?.findings.find((f) => f.finding_id === findingId);
  return run && finding ? { run, finding } : null;
}

export const handlers = [
  http.get('/health/live', () => HttpResponse.json({ status: 'alive' })),

  http.post(`${API}/benchmarks/upload`, async ({ request }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const ctype = request.headers.get('content-type') ?? '';
    const boundary = ctype.split('boundary=')[1];
    const parts: Record<string, { filename?: string; type?: string; value: string }> = {};
    for (const raw of (await request.text()).split(`--${boundary}`)) {
      const [head, ...rest] = raw.split('\r\n\r\n');
      const fieldName = /name="([^"]+)"/.exec(head)?.[1];
      if (!fieldName) continue;
      parts[fieldName] = {
        filename: /filename="([^"]+)"/.exec(head)?.[1],
        type: /Content-Type: (\S+)/i.exec(head)?.[1],
        value: rest.join('\r\n\r\n').replace(/\r\n$/, ''),
      };
    }
    const name = parts.name?.value ?? '';
    const file = parts.file;
    if (!file) return error(422, 'validation_failed', 'Request payload failed schema validation.', [{ field: 'file', code: 'missing', message: 'Field required' }]);
    const text = file.value;
    const isCsv = file.filename?.endsWith('.csv') || file.type?.includes('csv');
    let rows: Record<string, unknown>[];
    if (isCsv) rows = parseCsv(text);
    else {
      try {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : parsed?.items;
        if (!Array.isArray(rows)) throw new Error("JSON file must contain an array of items or an object with an 'items' array.");
      } catch (err) {
        return error(400, 'validation_failed', `Malformed JSON file: ${(err as Error).message}`);
      }
    }
    const errors = validateRows(rows);
    const badRows = new Set(errors.map((e) => e.row_number));
    const base = SCENARIOS[DEFAULT_SCENARIO_ID].benchmark_import;
    return HttpResponse.json({
      benchmark_id: errors.length ? null : `${base.benchmark_id}_${name.length}`,
      benchmark_version_id: errors.length ? null : base.benchmark_version_id,
      total_rows: rows.length,
      valid_rows: rows.length - badRows.size,
      status: errors.length ? 'rejected' : 'accepted',
      errors,
    });
  }),

  http.post(`${API}/policies`, async ({ request }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const body = (await request.json()) as EvaluationPolicyCreateRequest;
    const missing = (['name', 'evaluation_cutoff', 'reviewer_identity'] as const).filter((k) => !body[k]);
    if (missing.length) {
      return error(422, 'validation_failed', 'Request payload failed schema validation.', missing.map((m) => ({ field: m, code: 'invalid_missing', message: 'Field required' })));
    }
    const base = SCENARIOS[DEFAULT_SCENARIO_ID].policy;
    const created: EvaluationPolicyVersion = { ...base, ...body, policy_version_id: base.policy_version_id, created_at: new Date().toISOString() } as EvaluationPolicyVersion;
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post(`${API}/investigations`, async ({ request }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    if (!request.headers.get('idempotency-key')) {
      return error(422, 'validation_failed', 'Request payload failed schema validation.', [{ field: 'header.Idempotency-Key', code: 'invalid_missing', message: 'Field required' }]);
    }
    const body = (await request.json()) as { benchmark_version_id: string; policy_version_id: string };
    return HttpResponse.json(createMockRun(body.benchmark_version_id, body.policy_version_id), { status: 202 });
  }),

  http.get(`${API}/investigations/:id`, ({ request, params }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const run = getRun(String(params.id));
    if (!run) return error(404, 'not_found', `Investigation '${params.id}' not found.`);
    return HttpResponse.json(run.investigation);
  }),

  http.get(`${API}/investigations/:id/events`, ({ request, params }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const run = getRun(String(params.id));
    if (!run) return error(404, 'not_found', `Investigation '${params.id}' not found.`);
    const after = Number(request.headers.get('last-event-id') ?? 0);
    const frames = run.events.filter((e) => Number(e.id) > after);
    return sseResponse(frames, () => {
      if (!run.pendingDiscovery) return;
      run.pendingDiscovery = false;
      for (const e of frames) {
        if (e.type === 'investigation_completed') {
          Object.assign(run.investigation, {
            status: e.data.status,
            investigated_items: e.data.investigated_items,
            findings_count: e.data.findings_count,
            is_partial: e.data.is_partial,
          });
        }
        if (e.type === 'budget_updated') {
          Object.assign(run.investigation.budgets, {
            used_queries: e.data.used_queries,
            used_fetches: e.data.used_fetches,
            used_cost_usd: e.data.used_cost_usd,
          });
        }
      }
    });
  }),

  http.post(`${API}/investigations/:id/cancel`, async ({ request, params }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const run = getRun(String(params.id));
    if (!run) return error(404, 'not_found', `Investigation '${params.id}' not found.`);
    const { reason } = (await request.json()) as { reason: string };
    const cancelledAt = new Date().toISOString();
    if (run.investigation.status !== 'cancelled') {
      run.investigation.status = 'cancelled';
      run.investigation.is_partial = true;
      run.pendingDiscovery = false;
      const nextId = String(Math.max(0, ...run.events.map((e) => Number(e.id))) + 1);
      run.events.push({ id: nextId, type: 'investigation_cancelled', data: { cancelled_at: cancelledAt, reason } });
    }
    return HttpResponse.json({ investigation_id: params.id, status: 'cancelled', message: 'Investigation successfully cancelled.', cancelled_at: cancelledAt });
  }),

  http.post(`${API}/investigations/:id/verify`, ({ request, params }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const run = getRun(String(params.id));
    if (!run) return error(404, 'not_found', `Investigation '${params.id}' not found.`);
    let created = 0;
    if (run.pendingVerification) {
      const offset = Math.max(0, ...run.events.map((e) => Number(e.id)));
      run.pendingVerification.events.forEach((e, i) => run.events.push({ ...e, id: String(offset + i + 1) }));
      run.findings.push(...run.pendingVerification.findings);
      created = run.pendingVerification.findings.length;
      run.pendingVerification = null;
    }
    const counts: Record<string, number> = {};
    for (const f of run.findings) counts[f.claim.claim_status ?? 'candidate'] = (counts[f.claim.claim_status ?? 'candidate'] ?? 0) + 1;
    return HttpResponse.json({
      investigation_id: params.id,
      findings_created: created,
      grader_version: 'grader_v1.0',
      normalization_version: 'norm_v1.0',
      claim_status_counts: counts,
    });
  }),

  http.get(`${API}/investigations/:id/findings`, ({ request, params }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const run = getRun(String(params.id));
    if (!run) return error(404, 'not_found', `Investigation '${params.id}' not found.`);
    const q = new URL(request.url).searchParams;
    const items = run.findings.filter(
      (f) =>
        (!q.get('exposure_type') || f.claim.exposure_type === q.get('exposure_type')) &&
        (!q.get('claim_status') || f.claim.claim_status === q.get('claim_status')) &&
        (!q.get('temporal_status') || f.temporal.temporal_status === q.get('temporal_status'))
    );
    const page = Number(q.get('page') ?? 1);
    const size = Number(q.get('size') ?? 20);
    return HttpResponse.json({ items: items.slice((page - 1) * size, page * size), total: items.length, page, size });
  }),

  http.get(`${API}/findings/:id`, ({ request, params }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const hit = findFinding(String(params.id));
    if (!hit) return error(404, 'not_found', `Finding '${params.id}' not found.`);
    return HttpResponse.json(hit.finding);
  }),

  http.get(`${API}/findings/:id/reviews`, ({ request, params }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    if (!findFinding(String(params.id))) return error(404, 'not_found', `Finding '${params.id}' not found.`);
    return HttpResponse.json({ finding_id: params.id, decisions: mockDb.reviews.get(String(params.id)) ?? [] });
  }),

  http.post(`${API}/findings/:id/reviews`, async ({ request, params }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const hit = findFinding(String(params.id));
    if (!hit) return error(404, 'not_found', `Finding '${params.id}' not found.`);
    const body = (await request.json()) as ReviewCreateRequest;
    const { finding } = hit;
    if (body.action === 'confirm' && (finding.snapshot.availability !== 'available' || finding.verification.task_identity === 'different')) {
      return error(422, 'internal_error', 'Cannot confirm: required evidence (available snapshot with matching task) is missing.');
    }
    if (body.expected_version !== finding.version) {
      return error(409, 'version_conflict', `Version conflict: expected version ${body.expected_version}, finding is at version ${finding.version}. Reload and retry.`);
    }
    const decision: ReviewDecision = {
      decision_id: `rev_mock_${Date.now().toString(16)}`,
      finding_id: finding.finding_id,
      expected_version: body.expected_version,
      new_version: body.expected_version + 1,
      reviewer_id: 'usr_demo',
      action: body.action,
      reason: body.reason,
      reviewed_at: new Date().toISOString(),
    };
    finding.version = decision.new_version;
    finding.claim.claim_status = REVIEW_TO_CLAIM[body.action];
    finding.current_reviewer_decision = body.action;
    mockDb.reviews.set(finding.finding_id, [...(mockDb.reviews.get(finding.finding_id) ?? []), decision]);
    return HttpResponse.json(decision, { status: 201 });
  }),

  http.post(`${API}/investigations/:id/experiments`, ({ request }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    return error(501, 'not_implemented', 'Contract placeholder only. Operational endpoint implementation is deferred to B4+.');
  }),

  http.post(`${API}/investigations/:id/reports`, ({ request, params }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const run = getRun(String(params.id));
    if (!run) return error(404, 'not_found', `Investigation '${params.id}' not found.`);
    if (params.id === SCENARIOS['5-report-generation-failure'].investigation.investigation_id) {
      return HttpResponse.json(SCENARIOS['5-report-generation-failure'].report, { status: 202 });
    }
    const existing = [...mockDb.reports.values()].filter((r) => r.content?.investigation_id === params.id);
    const version = `R-${String(existing.length + 1).padStart(3, '0')}`;
    const reportId = `rpt_mock_${++mockDb.counter}`;
    const base = SCENARIOS[DEFAULT_SCENARIO_ID].report_download ?? {};
    const status: ReportStatusResponse = {
      report_id: reportId,
      report_version: version,
      status: 'completed',
      download_url: `${API}/reports/${reportId}/download`,
      authorized_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    mockDb.reports.set(reportId, {
      status,
      content: { ...base, report_id: reportId, report_version: version, investigation_id: params.id, frozen_at: new Date().toISOString() },
    });
    return HttpResponse.json(status, { status: 202 });
  }),

  http.get(`${API}/reports/:id`, ({ request, params }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const r = mockDb.reports.get(String(params.id));
    if (!r) return error(404, 'not_found', `Report '${params.id}' not found.`);
    const authorized_until = r.status.status === 'completed' ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    r.status = { ...r.status, authorized_until };
    return HttpResponse.json(r.status);
  }),

  http.get(`${API}/reports/:id/download`, ({ request, params }) => {
    const denied = authFailure(request);
    if (denied) return denied;
    const r = mockDb.reports.get(String(params.id));
    if (!r) return error(404, 'not_found', `Report '${params.id}' not found.`);
    if (r.status.status !== 'completed' || !r.content) return error(409, 'version_conflict', `Report is '${r.status.status}'.`);
    return HttpResponse.json(r.content);
  }),
];
