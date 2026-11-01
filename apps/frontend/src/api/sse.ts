import { EVENT_TYPES, type InvestigationEvent } from '@benchshield/api-client';
import { rawRequest } from './http.js';

const KNOWN_TYPES = new Set<string>(EVENT_TYPES);

/**
 * Parses one SSE frame ("id: 3\nevent: budget_updated\ndata: {...}").
 * Returns null for heartbeats/comments and unknown event types.
 */
export function parseSseFrame(frame: string): InvestigationEvent | null {
  let id = '';
  let type = 'message';
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const idx = line.indexOf(':');
    const field = idx === -1 ? line : line.slice(0, idx);
    const value = idx === -1 ? '' : line.slice(idx + 1).replace(/^ /, '');
    if (field === 'id') id = value;
    else if (field === 'event') type = value;
    else if (field === 'data') data.push(value);
  }
  if (!data.length || !KNOWN_TYPES.has(type)) return null;
  try {
    return { id, type, data: JSON.parse(data.join('\n')) } as InvestigationEvent;
  } catch {
    return null;
  }
}

/**
 * Streams an investigation's events until the server closes the stream.
 *
 * Uses fetch instead of EventSource because the backend requires the
 * Authorization and X-Workspace-ID headers, which EventSource cannot send.
 * Resumes from `lastEventId` via the Last-Event-ID header.
 */
export async function streamInvestigationEvents(
  investigationId: string,
  opts: { lastEventId?: string | null; signal: AbortSignal; onEvent: (e: InvestigationEvent) => void }
): Promise<void> {
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (opts.lastEventId) headers['Last-Event-ID'] = opts.lastEventId;

  const res = await rawRequest(`/api/v1/investigations/${encodeURIComponent(investigationId)}/events`, {
    headers,
    signal: opts.signal,
  });
  if (!res.body) {
    // Environments without streaming bodies: parse the whole response at once.
    const text = await res.text();
    text.split(/\r?\n\r?\n/).forEach((f) => {
      const e = parseSseFrame(f);
      if (e) opts.onEvent(e);
    });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? '';
    for (const f of frames) {
      const e = parseSseFrame(f);
      if (e) opts.onEvent(e);
    }
  }
  const tail = parseSseFrame(buffer);
  if (tail) opts.onEvent(tail);
}
