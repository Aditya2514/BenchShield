import { useState } from 'react';
import {
  Play,
  StopCircle,
  AlertTriangle,
  RotateCw,
  Clock,
  DollarSign,
  Activity,
  Layers,
  Radio,
} from 'lucide-react';
import { useInvestigationEvents, SSEEventEnvelope } from './useInvestigationEvents.js';
import type { InvestigationResponse } from '@benchshield/api-client';

interface InvestigationViewProps {
  initialInvestigation: InvestigationResponse;
  eventsSequence?: SSEEventEnvelope[];
}

export function InvestigationView({
  initialInvestigation,
  eventsSequence = [],
}: InvestigationViewProps) {
  const [isLaunching, setIsLaunching] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [lastIdempotencyKey, setLastIdempotencyKey] = useState<string | null>(null);

  const {
    investigation,
    setInvestigation,
    events,
    isConnected,
    cursorExpired,
    refreshSnapshot,
  } = useInvestigationEvents({
    investigationId: initialInvestigation?.id || null,
    initialInvestigation,
    mockEventSequence: eventsSequence,
  });

  const activeInv = investigation || initialInvestigation;

  const handleLaunch = async () => {
    setIsLaunching(true);
    // Generate unique Idempotency-Key
    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setLastIdempotencyKey(idempotencyKey);

    try {
      const res = await fetch('/api/v1/investigations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          benchmark_version_id: activeInv.benchmark_version_id,
          policy_version_id: activeInv.policy_version_id,
        }),
      });

      if (res.ok) {
        await refreshSnapshot();
      }
    } catch (err) {
      console.error('Launch failed:', err);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleCancel = async () => {
    if (!activeInv?.id) return;
    setIsCancelling(true);

    try {
      const res = await fetch(`/api/v1/investigations/${activeInv.id}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        setInvestigation((prev) => (prev ? { ...prev, state: 'cancelled' } : null));
        await refreshSnapshot();
      }
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Investigation Status & Controls Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-950 text-indigo-400 border border-indigo-700/50 rounded-lg">
              <Activity className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Investigation Operations</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-950 text-indigo-300 border border-indigo-700/60 uppercase">
                  {activeInv.state}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] ${
                    isConnected
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Radio className="w-3 h-3 animate-pulse" aria-hidden="true" />
                  {isConnected ? 'SSE Live' : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ID: <code className="text-slate-300">{activeInv.id}</code> | Benchmark: <code className="text-slate-300">{activeInv.benchmark_version_id}</code> | Policy: <code className="text-slate-300">{activeInv.policy_version_id}</code>
              </p>
            </div>
          </div>

          {/* Action Buttons: Launch with Idempotency Key & Idempotent Cancel */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleLaunch}
              disabled={isLaunching}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              {isLaunching ? 'Dispatching...' : 'Launch with Idempotency'}
            </button>

            {activeInv.state !== 'cancelled' && (
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="px-3.5 py-2 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <StopCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {isCancelling ? 'Halting...' : 'Cancel Run'}
              </button>
            )}

            <button
              onClick={refreshSnapshot}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg text-xs border border-slate-700"
              title="Refresh state snapshot"
              aria-label="Refresh state snapshot"
            >
              <RotateCw className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Expired Cursor Reconnect Alert */}
        {cursorExpired && (
          <div role="status" className="p-3 bg-indigo-950/60 border border-indigo-700/60 rounded-lg text-xs text-indigo-300 flex items-center justify-between">
            <span>SSE Reconnect Cursor expired. State snapshot has been refreshed automatically.</span>
            <button onClick={refreshSnapshot} className="underline text-indigo-200 hover:text-white">
              Sync Now
            </button>
          </div>
        )}

        {/* Idempotency Key Provenance */}
        {lastIdempotencyKey && (
          <div className="text-[11px] font-mono text-slate-500">
            Last Dispatched Idempotency-Key: <span className="text-slate-400">{lastIdempotencyKey}</span>
          </div>
        )}

        {/* Mandatory Partial Coverage Warning Banner */}
        {activeInv.partial_coverage && (
          <div
            role="alert"
            className="p-4 rounded-lg bg-amber-950/70 border border-amber-700/70 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-amber-200">
                Partial Coverage Audit Warning
              </h3>
              <p className="text-xs text-amber-300/90 mt-0.5">
                This investigation encountered provider limits or outages. Incomplete coverage must never be interpreted as an unexposed or clean certification.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-400 list-disc list-inside">
                {activeInv.coverage_limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Budget Ceilings & Execution Counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 block flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" /> Items Processed
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-white">{activeInv.counts.processed_items}</span>
              <span className="text-xs text-slate-500">/ {activeInv.counts.total_items} items</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 block flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" /> Search Queries
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-white">{activeInv.budget_usage.queries_executed}</span>
              <span className="text-xs text-slate-500">queries executed</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 block flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" /> Pages Fetched
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-white">{activeInv.budget_usage.pages_fetched}</span>
              <span className="text-xs text-slate-500">pages staged</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 block flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> Spend Reconciled
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-300">
                ${activeInv.budget_usage.spend_usd.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500">USD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Deduplicated Progress Timeline */}
      <section aria-labelledby="timeline-title" className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 id="timeline-title" className="text-sm font-semibold text-white">
              Investigation Progress Timeline (SSE Stream)
            </h3>
            <p className="text-xs text-slate-400">
              Monotonically ordered events with reconnect cursor and deduplication.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono">
            {events.length} unique event(s) recorded
          </span>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-mono">
            Awaiting streaming events from orchestrator...
          </div>
        ) : (
          <div className="space-y-3 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-800">
            {events.map((evt) => (
              <div key={evt.event_id} className="relative flex items-start gap-4 pl-9">
                <span className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-900" aria-hidden="true" />
                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                    <span className="text-indigo-300 font-semibold">{evt.event_id}</span>
                    <span>{new Date(evt.time).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1 font-semibold text-slate-200">{evt.type}</div>
                  {evt.data && (
                    <div className="mt-1 text-[11px] text-slate-400 font-mono bg-slate-900/60 p-2 rounded border border-slate-800/80">
                      state: {evt.data.state} | items: {evt.data.processed_items ?? 0} | queries: {evt.data.queries_executed ?? 0}
                      {evt.data.failure_reason && (
                        <div className="text-red-400 mt-1">failure: {evt.data.failure_reason}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

