import { useCallback, useEffect, useRef, useState } from 'react';
import type { InvestigationEvent, InvestigationStatusResponse } from '@benchshield/api-client';
import { getInvestigation } from '../../api/endpoints.js';
import { ApiError, errorMessage } from '../../api/http.js';
import { streamInvestigationEvents } from '../../api/sse.js';

/** Statuses where the backend worker may still emit events. */
export const ACTIVE_STATUSES = new Set(['queued', 'validating', 'discovering', 'verifying']);

export type StreamState = 'connecting' | 'live' | 'idle' | 'error';

/** Applies one event to the latest snapshot without reviving a cancelled run. */
export function applyEvent(
  inv: InvestigationStatusResponse | null,
  e: InvestigationEvent
): InvestigationStatusResponse | null {
  if (!inv) return inv;
  if (inv.status === 'cancelled' && e.type !== 'investigation_cancelled') return inv;
  switch (e.type) {
    case 'budget_updated':
      return {
        ...inv,
        budgets: {
          ...inv.budgets,
          used_queries: e.data.used_queries,
          used_fetches: e.data.used_fetches,
          used_cost_usd: e.data.used_cost_usd,
        },
      };
    case 'item_investigation_started':
      return { ...inv, status: inv.status === 'queued' ? 'discovering' : inv.status };
    case 'investigation_completed':
      return {
        ...inv,
        status: e.data.status,
        investigated_items: e.data.investigated_items,
        findings_count: e.data.findings_count,
        is_partial: e.data.is_partial,
      };
    case 'investigation_cancelled':
      return { ...inv, status: 'cancelled' };
    case 'investigation_failed':
      return { ...inv, status: 'failed' };
    case 'investigation_blocked':
      return { ...inv, status: 'policy_blocked' };
    default:
      return inv;
  }
}

/** Human-readable reason for a failed or blocked run, taken from its events. */
export function failureReasonFrom(events: InvestigationEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'investigation_failed') return `${e.data.failure_code}: ${e.data.message}`;
    if (e.type === 'investigation_blocked') return e.data.reason;
    if (e.type === 'investigation_cancelled') return `Cancelled: ${e.data.reason}`;
  }
  return null;
}

/**
 * Loads an investigation snapshot and follows its SSE stream.
 *
 * The backend closes the stream once the run is idle (e.g. awaiting_review).
 * When it does, the hook refreshes the snapshot and reconnects with
 * Last-Event-ID only while the run is still active. Call `follow()` after an
 * action that emits new events (verify, cancel) to resume streaming.
 */
export function useInvestigation(investigationId: string | null) {
  const [investigation, setInvestigation] = useState<InvestigationStatusResponse | null>(null);
  const [events, setEvents] = useState<InvestigationEvent[]>([]);
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cursorExpired, setCursorExpired] = useState(false);

  const seenIds = useRef<Set<string>>(new Set());
  const lastEventId = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshSnapshot = useCallback(async () => {
    if (!investigationId) return null;
    try {
      const snap = await getInvestigation(investigationId);
      setInvestigation(snap);
      setLoadError(null);
      return snap;
    } catch (err) {
      setLoadError(errorMessage(err));
      return null;
    }
  }, [investigationId]);

  const handleEvent = useCallback((e: InvestigationEvent) => {
    if (seenIds.current.has(e.id)) return;
    seenIds.current.add(e.id);
    lastEventId.current = e.id;
    setEvents((prev) => [...prev, e]);
    setInvestigation((prev) => applyEvent(prev, e));
  }, []);

  const follow = useCallback(async () => {
    if (!investigationId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    for (let attempt = 0; !controller.signal.aborted; attempt++) {
      setStreamState('connecting');
      try {
        setStreamState('live');
        await streamInvestigationEvents(investigationId, {
          lastEventId: lastEventId.current,
          signal: controller.signal,
          onEvent: handleEvent,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 410) {
          // Cursor expired: replay from the start; duplicates are dropped by id.
          setCursorExpired(true);
          lastEventId.current = null;
        } else if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
          setStreamState('error');
          setLoadError(errorMessage(err));
          return;
        } else {
          setStreamState('error');
        }
      }
      if (controller.signal.aborted) return;
      const snap = await refreshSnapshot();
      if (!snap || !ACTIVE_STATUSES.has(snap.status)) {
        setStreamState('idle');
        return;
      }
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** Math.min(attempt, 4), 10000)));
    }
  }, [investigationId, handleEvent, refreshSnapshot]);

  useEffect(() => {
    seenIds.current = new Set();
    lastEventId.current = null;
    setEvents([]);
    setInvestigation(null);
    setCursorExpired(false);
    setLoadError(null);
    if (!investigationId) return;
    void refreshSnapshot().then((snap) => {
      if (snap) void follow();
    });
    return () => {
      abortRef.current?.abort();
      setStreamState('idle');
    };
  }, [investigationId, refreshSnapshot, follow]);

  return {
    investigation,
    setInvestigation,
    events,
    streamState,
    loadError,
    cursorExpired,
    refreshSnapshot,
    follow,
    failureReason: failureReasonFrom(events),
  };
}
