import { useState } from 'react';
import {
  Play,
  StopCircle,
  RotateCw,
  Clock,
  DollarSign,
  Activity,
  Layers,
  Radio,
} from 'lucide-react';
import { useInvestigationEvents, SSEEventEnvelope } from './useInvestigationEvents.js';
import type { InvestigationResponse } from '@benchshield/api-client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Alert,
} from '../../components/ui';

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

  const getStatusBadgeVariant = (state: string) => {
    switch (state) {
      case 'completed':
        return 'success' as const;
      case 'failed':
      case 'policy_blocked':
        return 'danger' as const;
      case 'running':
        return 'info' as const;
      default:
        return 'neutral' as const;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Investigation Status & Controls Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg shrink-0">
                <Activity className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Investigation Operations
                  </h2>
                  <Badge variant={getStatusBadgeVariant(activeInv.state)} className="font-mono uppercase">
                    {activeInv.state}
                  </Badge>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      isConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    <Radio className="w-3 h-3 animate-pulse" aria-hidden="true" />
                    {isConnected ? 'SSE Live' : 'Offline'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  ID: <code className="text-slate-700 font-semibold">{activeInv.id}</code> | Benchmark: <code className="text-slate-700 font-semibold">{activeInv.benchmark_version_id}</code> | Policy: <code className="text-slate-700 font-semibold">{activeInv.policy_version_id}</code>
                </p>
              </div>
            </div>

            {/* Action Buttons: Launch with Idempotency Key & Idempotent Cancel */}
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={handleLaunch}
                disabled={isLaunching}
                icon={<Play className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                {isLaunching ? 'Dispatching...' : 'Launch with Idempotency'}
              </Button>

              {activeInv.state !== 'cancelled' && (
                <Button
                  variant="danger"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  icon={<StopCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  {isCancelling ? 'Halting...' : 'Cancel Run'}
                </Button>
              )}

              <Button
                variant="secondary"
                onClick={refreshSnapshot}
                title="Refresh state snapshot"
                aria-label="Refresh state snapshot"
              >
                <RotateCw className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Expired Cursor Reconnect Alert */}
          {cursorExpired && (
            <Alert variant="info" title="Cursor Expired">
              <div className="flex items-center justify-between gap-2">
                <span>SSE Reconnect Cursor expired. State snapshot has been refreshed automatically.</span>
                <button
                  type="button"
                  onClick={refreshSnapshot}
                  className="underline font-semibold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                >
                  Sync Now
                </button>
              </div>
            </Alert>
          )}

          {/* Idempotency Key Provenance */}
          {lastIdempotencyKey && (
            <div className="text-[11px] font-mono text-slate-500">
              Last Dispatched Idempotency-Key: <span className="text-slate-700 font-semibold">{lastIdempotencyKey}</span>
            </div>
          )}

          {/* Mandatory Partial Coverage Warning Banner */}
          {activeInv.partial_coverage && (
            <Alert variant="warning" title="Partial Coverage Audit Warning">
              <p className="mt-0.5">
                This investigation encountered provider limits or outages. Incomplete coverage must never be interpreted as an unexposed or clean certification.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-900 list-disc list-inside font-medium">
                {activeInv.coverage_limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Budget Ceilings & Execution Counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-600 font-semibold block flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" /> Items Processed
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900">{activeInv.counts.processed_items}</span>
                <span className="text-xs text-slate-500 font-medium">/ {activeInv.counts.total_items} items</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-600 font-semibold block flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" /> Search Queries
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900">{activeInv.budget_usage.queries_executed}</span>
                <span className="text-xs text-slate-500 font-medium">queries executed</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-600 font-semibold block flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" /> Pages Fetched
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900">{activeInv.budget_usage.pages_fetched}</span>
                <span className="text-xs text-slate-500 font-medium">pages staged</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-600 font-semibold block flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> Spend Reconciled
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold text-emerald-800">
                  ${activeInv.budget_usage.spend_usd.toFixed(2)}
                </span>
                <span className="text-xs text-slate-500 font-medium">USD</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Deduplicated Progress Timeline */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div>
              <CardTitle id="timeline-title">Investigation Progress Timeline (SSE Stream)</CardTitle>
              <CardDescription>
                Monotonically ordered events with reconnect cursor and deduplication.
              </CardDescription>
            </div>
            <Badge variant="neutral" className="font-mono">
              {events.length} unique event(s) recorded
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs font-mono">
              Awaiting streaming events from orchestrator...
            </div>
          ) : (
            <div className="space-y-3 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-200">
              {events.map((evt) => (
                <div key={evt.event_id} className="relative flex items-start gap-4 pl-9">
                  <span className="absolute left-2.5 top-2 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white ring-2 ring-indigo-100" aria-hidden="true" />
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs shadow-2xs">
                    <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
                      <span className="text-indigo-700 font-bold">{evt.event_id}</span>
                      <span>{new Date(evt.time).toLocaleTimeString()}</span>
                    </div>
                    <div className="mt-1 font-semibold text-slate-900">{evt.type}</div>
                    {evt.data && (
                      <div className="mt-1.5 text-[11px] text-slate-700 font-mono bg-white p-2.5 rounded-lg border border-slate-200">
                        state: <span className="font-semibold">{evt.data.state}</span> | items: {evt.data.processed_items ?? 0} | queries: {evt.data.queries_executed ?? 0}
                        {evt.data.failure_reason && (
                          <div className="text-red-600 mt-1 font-semibold">failure: {evt.data.failure_reason}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
