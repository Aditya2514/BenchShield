import type { ErrorDetail, ErrorResponse } from '@benchshield/api-client';

/**
 * Credentials for the BenchShield API. The backend verifies a signed JWT and
 * checks workspace membership server-side on every request.
 *
 * Only the token and workspace ID are kept in sessionStorage (cleared when the
 * tab closes). Benchmark content and gold answers are never stored client-side.
 */
export interface Session {
  token: string;
  workspaceId: string;
  /** Display label only (e.g. the user's email). Not used for authorization. */
  label?: string;
}

const SESSION_KEY = 'benchshield.session';

let currentSession: Session | null = readStoredSession();
const unauthorizedListeners = new Set<() => void>();

function readStoredSession(): Session | null {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed.token && parsed.workspaceId ? parsed : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return currentSession;
}

export function setSession(session: Session | null): void {
  currentSession = session;
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can be unavailable (private mode); the in-memory session still works.
  }
}

/** Subscribe to HTTP 401 responses (expired or invalid token). */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/** A non-2xx response, parsed from the backend's standard ErrorResponse body. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];
  readonly requestId?: string;

  constructor(status: number, body: Partial<ErrorResponse> | null, fallback: string) {
    super(body?.message || fallback);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error || 'internal_error';
    this.details = body?.details || [];
    this.requestId = body?.request_id;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const detail = err.details.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message)).join('; ');
    return detail ? `${err.message} (${detail})` : err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Unexpected error.';
}

export function authHeaders(): Record<string, string> {
  const s = currentSession;
  return s ? { Authorization: `Bearer ${s.token}`, 'X-Workspace-ID': s.workspaceId } : {};
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  json?: unknown;
  form?: FormData;
  /** Pre-encoded body; caller sets Content-Type. */
  body?: string;
  query?: Record<string, string | number | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Raw authenticated fetch. Throws ApiError on non-2xx and notifies 401 listeners. */
export async function rawRequest(path: string, opts: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { ...authHeaders(), ...opts.headers };
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    body = opts.body;
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method || (body ? 'POST' : 'GET'),
    headers,
    body,
    signal: opts.signal,
  });

  if (!res.ok) {
    let parsed: Partial<ErrorResponse> | null = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    if (res.status === 401) unauthorizedListeners.forEach((l) => l());
    throw new ApiError(res.status, parsed, `Request failed (HTTP ${res.status}).`);
  }
  return res;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await rawRequest(path, opts);
  return (await res.json()) as T;
}

export function newIdempotencyKey(prefix = 'ui'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}
