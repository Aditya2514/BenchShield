import React, { useState } from 'react';
import {
  Play,
  StopCircle,
  RotateCw,
  Clock,
  DollarSign,
  Activity,
  Layers,
  Radio,
  ShieldCheck,
  FolderOpen,
  ArrowRight,
  Plus,
} from 'lucide-react';
import type { InvestigationEvent, VerificationRunResponse } from '@benchshield/api-client';
import { cancelInvestigation, launchInvestigation, verifyInvestigation } from '../../api/endpoints.js';
import { errorMessage, newIdempotencyKey } from '../../api/http.js';
import type { NavTab } from '../../components/Shell.js';
import type { Workflow } from '../../workflow.js';
import { ACTIVE_STATUSES, useInvestigation } from './useInvestigationEvents.js';
import { CoverageWarning } from './CoverageWarning.js';
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
  workflow: Workflow;
  onInvestigationChange: (investigationId: string | null) => void;
  onNavigate?: (tab: NavTab) => void;
}

export function getStatusBadgeVariant(state: string) {
  switch (state) {
    case 'completed':
    case 'awaiting_review':
      return 'success' as const;
    case 'failed':
    case 'policy_blocked':
    case 'budget_exhausted':
      return 'danger' as const;
    case 'cancelled':
      return 'warning' as const;
    case 'queued':
    case 'validating':
    case 'discovering':
    case 'verifying':
      return 'info' as const;
    default:
      return 'neutral' as const;
  }
}

/** One-line description of an event for the timeline. */
export function describeEvent(e: InvestigationEvent): string {
  switch (e.type) {
    case 'investigation_queued':
      return `Queued ${e.data.total_items} item(s)`;
    case 'investigation_started':
      return `Started ${e.data.total_items} item(s)`;
    case 'phase_transition':
      return `${e.data.from_phase} → ${e.data.to_phase}`;
    case 'item_investigation_started':
      return `Searching item ${e.data.item_index}: ${e.data.external_id}`;
    case 'candidate_discovered':
      return `${e.data.external_id}: candidate source (${e.data.source_family}) ${e.data.source_url}`;
    case 'verification_completed':
      return `${e.data.external_id}: ${e.data.claim_status} ${e.data.exposure_type} (task ${e.data.task_identity}, answer ${e.data.answer_match}, ${e.data.temporal_status})`;
    case 'budget_updated':
      return `Budget: ${e.data.used_queries}/${e.data.max_queries} queries, ${e.data.used_fetches}/${e.data.max_fetches} fetches, $${e.data.used_cost_usd.toFixed(2)} of $${e.data.cost_ceiling_usd.toFixed(2)}`;
    case 'investigation_completed':
      return `Discovery finished: ${e.data.investigated_items}/${e.data.total_items} items, ${e.data.findings_count} candidate(s)${e.data.is_partial ? ', PARTIAL coverage' : ''} → ${e.data.status}`;
    case 'investigation_failed':
      return `Failed (${e.data.failure_code}): ${e.data.message}`;
    case 'investigation_cancelled':
      return `Cancelled: ${e.data.reason}`;
    case 'investigation_blocked':
      return `Blocked by policy: ${e.data.reason}`;
    case 'snapshot_refresh_required':
      return 'Snapshot refresh required';
  }
}

function LaunchPanel({ workflow, onLaunched, onNavigate }: {
  workflow: Workflow;
  onLaunched: (id: string) => void;
  onNavigate?: (tab: NavTab) => void;
}) {
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState('');
  const ready = Boolean(workflow.benchmark && workflow.policy);

  const handleLaunch = async () => {
    if (!workflow.benchmark || !workflow.policy) return;
    setIsLaunching(true);
    setError(null);
    try {
      const inv = await launchInvestigation(
        workflow.benchmark.benchmark_version_id,
        workflow.policy.policy_version_id,
        newIdempotencyKey('launch')
      );
      onLaunched(inv.investigation_id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLaunching(false);
    }
  };

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    if (existingId.trim()) onLaunched(existingId.trim());
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg shrink-0">
            <Activity className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle>Launch Investigation</CardTitle>
            <CardDescription>Runs bounded discovery for the staged benchmark under the selected policy.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <Alert variant="danger" title="Launch rejected">
            {error}
          </Alert>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-semibold text-slate-600 block mb-1">Benchmark version</span>
            {workflow.benchmark ? (
              <code className="text-slate-900 font-semibold">{workflow.benchmark.benchmark_version_id}</code>
            ) : (
              <button type="button" className="underline text-indigo-700 cursor-pointer" onClick={() => onNavigate?.('benchmarks')}>
                Import a benchmark first
              </button>
            )}
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-semibold text-slate-600 block mb-1">Policy version</span>
            {workflow.policy ? (
              <code className="text-slate-900 font-semibold">{workflow.policy.policy_version_id}</code>
            ) : (
              <button type="button" className="underline text-indigo-700 cursor-pointer" onClick={() => onNavigate?.('policies')}>
                Create a policy first
              </button>
            )}
          </div>
        </div>
        <Button onClick={handleLaunch} disabled={!ready || isLaunching} icon={<Play className="w-4 h-4" aria-hidden="true" />}>
          {isLaunching ? 'Dispatching...' : 'Launch Investigation'}
        </Button>

        <form onSubmit={handleOpen} className="flex flex-wrap items-end gap-2 pt-3 border-t border-slate-100">
          <div>
            <label htmlFor="existing-investigation" className="block text-xs font-semibold text-slate-700 mb-1">
              Or open an existing investigation
            </label>
            <input
              id="existing-investigation"
              value={existingId}
              onChange={(e) => setExistingId(e.target.value)}
              placeholder="inv_..."
              className="w-64 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" icon={<FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />}>
            Open
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function InvestigationView({ workflow, onInvestigationChange, onNavigate }: InvestigationViewProps) {
  const investigationId = workflow.investigationId;
  const {
    investigation,
    events,
    streamState,
    loadError,
    cursorExpired,
    refreshSnapshot,
    follow,
    failureReason,
  } = useInvestigation(investigationId);

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('Stopped by operator');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verification, setVerification] = useState<VerificationRunResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!investigationId) {
    return <LaunchPanel workflow={workflow} onLaunched={onInvestigationChange} onNavigate={onNavigate} />;
  }

  const handleCancel = async () => {
    setIsCancelling(true);
    setActionError(null);
    try {
      await cancelInvestigation(investigationId, cancelReason || 'Stopped by operator');
      await refreshSnapshot();
      void follow();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setActionError(null);
    try {
      setVerification(await verifyInvestigation(investigationId));
      await refreshSnapshot();
      void follow(); // pick up verification_completed events
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const status = investigation?.status ?? 'loading';
  const isActive = ACTIVE_STATUSES.has(status);
  const canVerify = status === 'awaiting_review' || status === 'completed';
  const blockedOrFailed = ['failed', 'policy_blocked', 'budget_exhausted'].includes(status);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg shrink-0">
                <Activity className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Investigation Operations</h2>
                  <Badge variant={getStatusBadgeVariant(status)} className="font-mono uppercase">
                    {status}
                  </Badge>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      streamState === 'live'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    <Radio className={`w-3 h-3 ${streamState === 'live' ? 'animate-pulse' : ''}`} aria-hidden="true" />
                    {streamState === 'live' ? 'Streaming events' : streamState === 'error' ? 'Stream error' : 'Stream idle'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  ID: <code className="text-slate-700 font-semibold">{investigationId}</code>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={handleVerify}
                disabled={!canVerify || isVerifying}
                title={canVerify ? 'Grade discovered candidates' : 'Available once discovery has finished'}
                icon={<ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                {isVerifying ? 'Verifying...' : 'Run Verification'}
              </Button>
              {isActive && (
                <Button
                  variant="danger"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  icon={<StopCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  {isCancelling ? 'Halting...' : 'Cancel Run'}
                </Button>
              )}
              <Button variant="secondary" onClick={() => void refreshSnapshot()} aria-label="Refresh state snapshot" title="Refresh state snapshot">
                <RotateCw className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => onInvestigationChange(null)}
                icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                New
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loadError && (
            <Alert variant="danger" title="Could not load investigation">
              {loadError}
            </Alert>
          )}
          {actionError && (
            <Alert variant="danger" title="Action failed">
              {actionError}
            </Alert>
          )}
          {cursorExpired && (
            <Alert variant="info" title="Cursor Expired">
              The event cursor expired, so the stream was replayed from the start and the snapshot refreshed.
            </Alert>
          )}
          {isActive && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label htmlFor="cancel-reason" className="font-semibold text-slate-700">
                Cancel reason:
              </label>
              <input
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-64 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          )}

          {blockedOrFailed && (
            <Alert variant="danger" title={`Audit Execution Halted (${status})`}>
              <p className="mt-0.5">{failureReason ?? 'The run stopped before completing discovery.'}</p>
              <p className="mt-1 text-xs">No exposure claims are made for items that were not investigated.</p>
            </Alert>
          )}

          {investigation && <CoverageWarning investigation={investigation} />}

          {canVerify && !verification && (
            <Alert variant="info" title="Discovery finished: verification is a separate step">
              Candidates are not findings until the trusted grader checks task identity, answer agreement and timing.
              Click <strong>Run Verification</strong> to create findings.
            </Alert>
          )}

          {verification && (
            <Alert variant="success" title={`Verification complete (${verification.grader_version})`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {verification.findings_created} new finding(s).{' '}
                  {Object.entries(verification.claim_status_counts ?? {})
                    .map(([k, v]) => `${v} ${k}`)
                    .join(', ')}
                </span>
                {onNavigate && (
                  <Button size="sm" variant="secondary" onClick={() => onNavigate('findings')} icon={<ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}>
                    Review findings
                  </Button>
                )}
              </div>
            </Alert>
          )}

          {investigation && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-600 font-semibold block flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" /> Items Investigated
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-slate-900">{investigation.investigated_items}</span>
                  <span className="text-xs text-slate-500 font-medium">/ {investigation.total_items} items</span>
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-600 font-semibold block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" /> Search Queries
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-slate-900">{investigation.budgets.used_queries ?? 0}</span>
                  <span className="text-xs text-slate-500 font-medium">/ {investigation.budgets.max_queries} max</span>
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-600 font-semibold block flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" /> Pages Fetched
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-slate-900">{investigation.budgets.used_fetches ?? 0}</span>
                  <span className="text-xs text-slate-500 font-medium">/ {investigation.budgets.max_fetches} max</span>
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-600 font-semibold block flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> Spend
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-emerald-800">${(investigation.budgets.used_cost_usd ?? 0).toFixed(2)}</span>
                  <span className="text-xs text-slate-500 font-medium">of ${investigation.budgets.cost_ceiling_usd.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div>
              <CardTitle id="timeline-title">Investigation Progress Timeline (SSE Stream)</CardTitle>
              <CardDescription>Monotonically ordered events; reconnects resume from the last event ID.</CardDescription>
            </div>
            <Badge variant="neutral" className="font-mono">
              {events.length} unique event(s) recorded
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs font-mono">Awaiting streaming events from orchestrator...</div>
          ) : (
            <ol className="space-y-3 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-200" aria-labelledby="timeline-title">
              {events.map((evt) => (
                <li key={evt.id} className="relative flex items-start gap-4 pl-9">
                  <span className="absolute left-2.5 top-2 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white ring-2 ring-indigo-100" aria-hidden="true" />
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs shadow-2xs">
                    <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
                      <span className="text-indigo-700 font-bold">#{evt.id}</span>
                      <span className="font-semibold text-slate-700">{evt.type}</span>
                    </div>
                    <div className="mt-1 text-slate-800 break-words">{describeEvent(evt)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
