import { useState, useEffect, useRef, useCallback } from 'react';
import type { InvestigationResponse } from '@benchshield/api-client';

export interface SSEEventEnvelope {
  event_id: string;
  entity_id: string;
  type: string;
  schema_version: string;
  time: string;
  data: any;
}

interface UseInvestigationEventsOptions {
  investigationId: string | null;
  initialInvestigation: InvestigationResponse | null;
  mockEventSequence?: SSEEventEnvelope[];
}

export function useInvestigationEvents({
  investigationId,
  initialInvestigation,
  mockEventSequence = [],
}: UseInvestigationEventsOptions) {
  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(initialInvestigation);
  const [events, setEvents] = useState<SSEEventEnvelope[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [cursorExpired, setCursorExpired] = useState<boolean>(false);

  // Set of seen event IDs for strict deduplication
  const seenEventIds = useRef<Set<string>>(new Set());
  const lastEventIdRef = useRef<string | null>(null);

  // Refresh full snapshot from server
  const refreshSnapshot = useCallback(async () => {
    if (!investigationId) return;
    try {
      const res = await fetch(`/api/v1/investigations/${investigationId}`);
      if (res.ok) {
        const data: InvestigationResponse = await res.json();
        setInvestigation(data);
        setCursorExpired(false);
      }
    } catch (err) {
      console.error('Failed to refresh investigation snapshot:', err);
    }
  }, [investigationId]);

  // Handle incoming event with deduplication
  const handleEvent = useCallback((event: SSEEventEnvelope) => {
    // If event is already processed, discard duplicate
    if (seenEventIds.current.has(event.event_id)) {
      return;
    }

    seenEventIds.current.add(event.event_id);
    lastEventIdRef.current = event.event_id;

    setEvents((prev) => [...prev, event]);

    // Apply incremental state updates (without reviving a cancelled run)
    if (event.data?.state) {
      setInvestigation((prev) => {
        if (!prev || prev.state === 'cancelled') return prev;
        return {
          ...prev,
          state: event.data.state,
          partial_coverage: event.data.partial_coverage ?? prev.partial_coverage,
          coverage_limitations: event.data.coverage_limitations ?? prev.coverage_limitations,
          counts: {
            ...prev.counts,
            processed_items: event.data.processed_items ?? prev.counts.processed_items,
            candidate_findings: event.data.candidate_findings ?? prev.counts.candidate_findings,
            verified_findings: event.data.verified_findings ?? prev.counts.verified_findings,
          },
          budget_usage: {
            ...prev.budget_usage,
            queries_executed: event.data.queries_executed ?? prev.budget_usage.queries_executed,
            pages_fetched: event.data.pages_fetched ?? prev.budget_usage.pages_fetched,
            spend_usd: event.data.spend_usd ?? prev.budget_usage.spend_usd,
          },
          failure_reason: event.data.failure_reason ?? prev.failure_reason,
        };
      });
    }
  }, []);

  // Simulate or connect SSE stream with reconnect cursor and deduplication
  useEffect(() => {
    if (!investigationId) return;

    setIsConnected(true);

    // If a mock event sequence is provided, replay them progressively
    if (mockEventSequence && mockEventSequence.length > 0) {
      let timer: NodeJS.Timeout | null = null;
      let idx = 0;

      const playNext = () => {
        if (idx < mockEventSequence.length) {
          handleEvent(mockEventSequence[idx]);
          idx++;
          timer = setTimeout(playNext, 40);
        }
      };

      playNext();

      return () => {
        if (timer) clearTimeout(timer);
        setIsConnected(false);
      };
    }

    // Live EventSource integration with Last-Event-ID reconnect
    const eventUrl = `/api/v1/investigations/${investigationId}/events`;
    let es: EventSource | null = null;

    try {
      es = new EventSource(eventUrl);

      es.onmessage = (e) => {
        try {
          const parsed: SSEEventEnvelope = JSON.parse(e.data);
          handleEvent(parsed);
        } catch (err) {
          console.error('Failed to parse SSE payload:', err);
        }
      };

      es.onerror = () => {
        // SSE reconnect / expired cursor handling: refresh snapshot
        setCursorExpired(true);
        refreshSnapshot();
      };
    } catch {
      // Fallback for environments without EventSource
      setIsConnected(false);
    }

    return () => {
      es?.close();
      setIsConnected(false);
    };
  }, [investigationId, mockEventSequence, handleEvent, refreshSnapshot]);

  return {
    investigation,
    setInvestigation,
    events,
    isConnected,
    cursorExpired,
    handleEvent,
    refreshSnapshot,
  };
}

