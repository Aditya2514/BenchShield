import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  CheckCircle,
  HelpCircle,
  Play,
  Terminal,
  X,
  ChevronDown,
} from 'lucide-react';
import type { ExperimentItem } from '@benchshield/api-client';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Alert,
  EmptyState,
  Spinner,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../../components/ui';

interface ExperimentsViewProps {
  investigation: {
    id: string;
    state: string;
    partial_coverage: boolean;
    coverage_limitations?: string[];
  };
}

export function ExperimentsView({ investigation }: ExperimentsViewProps) {
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected experiment for trajectory viewer
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentItem | null>(null);

  // Queue new experiment modal
  const [showQueueModal, setShowQueueModal] = useState<boolean>(false);
  const [newCondition, setNewCondition] = useState<'control' | 'blind' | 'evaluation_aware'>('blind');
  const [newModelId, setNewModelId] = useState<string>('gpt-4o-2026-08-06');
  const [newModelRev, setNewModelRev] = useState<string>('rev-1');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/investigations/${investigation.id}/experiments`);
      if (!res.ok) {
        throw new Error(`Failed to load experiments (HTTP ${res.status})`);
      }
      const data = (await res.json()) as { items: ExperimentItem[] };
      setExperiments(data.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error loading experiments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, [investigation.id]);

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/v1/investigations/${investigation.id}/experiments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          condition: newCondition,
          model_identifier: newModelId.trim(),
          model_revision: newModelRev.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to queue experiment (HTTP ${res.status})`);
      }

      setShowQueueModal(false);
      await fetchExperiments();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to queue experiment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group experiments strictly by model configuration (Stratification Rule)
  // "Never pool results across changed configurations without stratification."
  const groupedByConfig = experiments.reduce<Record<string, ExperimentItem[]>>((acc, exp) => {
    const key = `${exp.model_identifier} (rev: ${exp.model_revision})`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(exp);
    return acc;
  }, {});

  const configKeys = Object.keys(groupedByConfig);

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'control':
        return 'Control (No Web)';
      case 'blind':
        return 'Blind Browsing';
      case 'evaluation_aware':
        return 'Evaluation-Aware';
      default:
        return condition;
    }
  };

  const getAttributionBadge = (strength: string) => {
    switch (strength) {
      case 'none':
        return (
          <Badge variant="neutral">
            [–] None
          </Badge>
        );
      case 'retrieval_observed':
        return (
          <Badge variant="warning">
            [~] Retrieval Observed
          </Badge>
        );
      case 'use_supported':
        return (
          <Badge variant="info">
            [!] Use Supported
          </Badge>
        );
      case 'intervention_supported':
        return (
          <Badge variant="needs_review">
            [*] Intervention Supported
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral">
            {strength}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <section aria-labelledby="experiments-title">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-indigo-700 font-semibold uppercase tracking-wider">
                    ADR-001 Optional Comparative Evaluation
                  </span>
                  <Badge variant="needs_review" className="font-mono">
                    Isolated Attacker
                  </Badge>
                </div>
                <h2 id="experiments-title" className="text-xl font-bold text-slate-900 tracking-tight mt-1">
                  Controlled Attacker Experiments
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
                  Compare model performance under strictly controlled web conditions (Control vs Blind vs Evaluation-Aware). A failed experiment does not invalidate an otherwise complete exposure audit.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                onClick={() => setShowQueueModal(true)}
                icon={<Play className="w-4 h-4" aria-hidden="true" />}
              >
                Queue Controlled Experiment
              </Button>
            </div>

            {/* Stratification Rule Notice */}
            <div
              role="note"
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5"
            >
              <Layers className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <strong className="text-slate-900 font-semibold">Stratified Configuration Invariant:</strong> Results are strictly grouped by pinned model identifier and revision. They are never pooled across different configurations. Incomplete runs are explicitly excluded from accuracy denominators.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Loading & Error States */}
      {loading && (
        <Card className="p-12 text-center">
          <Spinner label="Loading controlled experiments..." size="lg" />
        </Card>
      )}

      {error && (
        <Alert variant="danger" title="Failed to Load Experiments">
          {error}
        </Alert>
      )}

      {/* Empty State */}
      {!loading && !error && experiments.length === 0 && (
        <EmptyState
          icon={<Cpu className="w-6 h-6 text-slate-500" aria-hidden="true" />}
          title="No Experiments Recorded"
          description="No comparative attacker runs have been dispatched for this investigation yet. Queue an experiment to test live browsing vs control."
          action={
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowQueueModal(true)}
              icon={<Play className="w-4 h-4" aria-hidden="true" />}
            >
              Queue Controlled Experiment
            </Button>
          }
        />
      )}

      {/* Stratified Groups */}
      {!loading &&
        configKeys.map((configKey) => {
          const groupExps = groupedByConfig[configKey];
          const firstExp = groupExps[0];

          return (
            <div
              key={configKey}
              data-testid={`config-group-${firstExp.model_identifier}`}
            >
              <Card>
                {/* Group Header: Pinned Configuration Summary */}
                <CardHeader className="bg-slate-50/80 border-b border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 shrink-0">
                        <Cpu className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono uppercase text-indigo-700 font-bold">Pinned Configuration</span>
                          <Badge variant="neutral" className="font-mono">
                            Stratified
                          </Badge>
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                          Model: <span className="font-mono text-indigo-800 font-bold">{firstExp.model_identifier}</span>
                          <span className="text-slate-500 font-normal ml-2">
                            (Revision: <span className="font-mono text-slate-700 font-medium">{firstExp.model_revision}</span>)
                          </span>
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <div>
                        <span className="block text-slate-400 text-[10px] uppercase font-mono font-semibold">Tool Policy</span>
                        <span className="text-slate-700 font-mono font-medium">allowlisted_browsing_v1</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 text-[10px] uppercase font-mono font-semibold">Reasoning Budget</span>
                        <span className="text-slate-700 font-mono font-medium">standard</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {/* Condition Comparison Table with Explicit Denominators */}
                <CardContent className="p-0">
                  <Table className="border-0 rounded-none">
                    <TableHeader>
                      <tr>
                        <TableHead>Condition</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Completed Runs</TableHead>
                        <TableHead>Incomplete Runs</TableHead>
                        <TableHead>Correct Answer Count &amp; Rate</TableHead>
                        <TableHead>Prohibited Retrieval</TableHead>
                        <TableHead>Attribution Strength</TableHead>
                        <TableHead className="text-right">Trajectories</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {groupExps.map((exp) => {
                        // Explicit Denominators Calculation
                        // Incomplete runs are explicitly excluded from accuracy denominator
                        const totalRuns = exp.completed_run_count + exp.incomplete_run_count;
                        const accuracyRate =
                          exp.completed_run_count > 0
                            ? ((exp.correct_answer_count / exp.completed_run_count) * 100).toFixed(1)
                            : '0.0';

                        const retrievalRate =
                          exp.completed_run_count > 0
                            ? ((exp.prohibited_retrieval_count / exp.completed_run_count) * 100).toFixed(1)
                            : '0.0';

                        return (
                          <TableRow key={exp.experiment_id}>
                            <TableCell className="font-semibold text-slate-900">
                              <span className="font-mono text-indigo-700 text-xs block font-bold">
                                {getConditionLabel(exp.condition)}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono font-normal">
                                ID: {exp.experiment_id}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="neutral" className="capitalize">
                                {exp.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">
                              <span className="text-slate-900 font-bold">{exp.completed_run_count}</span>
                              <span className="text-slate-500"> / {totalRuns}</span>
                            </TableCell>
                            <TableCell className="font-mono">
                              {exp.incomplete_run_count > 0 ? (
                                <span className="text-amber-800 font-bold">
                                  {exp.incomplete_run_count} (Excluded)
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono">
                              <div>
                                <span className="text-slate-900 font-bold">
                                  {exp.correct_answer_count} / {exp.completed_run_count}
                                </span>{' '}
                                <span className="text-slate-500 font-normal">({accuracyRate}%)</span>
                              </div>
                              <span className="text-[10px] text-slate-500 block">
                                Denominator excludes {exp.incomplete_run_count} incomplete
                              </span>
                            </TableCell>
                            <TableCell className="font-mono">
                              <div>
                                <span className="text-slate-900 font-bold">
                                  {exp.prohibited_retrieval_count} / {exp.completed_run_count}
                                </span>{' '}
                                <span className="text-slate-500 font-normal">({retrievalRate}%)</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getAttributionBadge(exp.attribution_strength)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedExperiment(exp)}
                                icon={<Terminal className="w-3.5 h-3.5" aria-hidden="true" />}
                                aria-label={`View trajectories for ${getConditionLabel(exp.condition)}`}
                              >
                                Inspect ({exp.trajectories?.length || 0})
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Explicit Denominators Footnote */}
                  <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <strong className="font-semibold text-slate-800">Denominators Invariant:</strong> Incomplete runs (e.g. timeout, provider rate limit) are strictly excluded from accuracy denominators and reported as separate counts. Never treat incomplete runs as incorrect answers or substitute fallback models into a comparative condition.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}

      {/* Observable Trajectory Viewer Drawer / Modal */}
      {selectedExperiment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Observable Trajectory Viewer"
          aria-labelledby="trajectory-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-900">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase text-indigo-700 font-bold">Observable Trajectory Viewer</span>
                  <Badge variant="warning" className="font-mono">
                    Untrusted Content
                  </Badge>
                </div>
                <h3 id="trajectory-modal-title" className="text-lg font-bold text-slate-900 mt-0.5">
                  Condition: {getConditionLabel(selectedExperiment.condition)} ({selectedExperiment.experiment_id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExperiment(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close trajectory viewer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Privacy Rule Banner */}
            <div className="bg-indigo-50/70 border-b border-indigo-100 px-6 py-2.5 text-xs text-indigo-950 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-indigo-700 shrink-0" aria-hidden="true" />
              <span>
                <strong>Privacy Invariant:</strong> Private model reasoning (chain-of-thought) is never recorded or displayed. Only observable tool calls, fetched content, and trusted grader outcomes are recorded.
              </span>
            </div>

            {/* Trajectory Runs List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {(!selectedExperiment.trajectories || selectedExperiment.trajectories.length === 0) && (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  No trajectories recorded for this experiment run.
                </div>
              )}

              {selectedExperiment.trajectories?.map((traj, idx) => (
                <div
                  key={traj.run_id || idx}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                  data-testid={`trajectory-run-${traj.run_id}`}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-900">
                        Run: {traj.run_id}
                      </span>
                      <Badge variant="neutral" className="font-mono">
                        Status: {traj.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 font-medium">Grader Outcome:</span>
                      <Badge
                        variant={
                          traj.grader_outcome === 'correct'
                            ? 'success'
                            : traj.grader_outcome === 'incorrect'
                            ? 'danger'
                            : 'neutral'
                        }
                        className="font-mono"
                      >
                        {traj.grader_outcome}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-slate-600 font-semibold block mb-1">
                      Observable Tool Calls ({traj.observable_tool_calls?.length || 0}):
                    </span>
                    {traj.observable_tool_calls && traj.observable_tool_calls.length > 0 ? (
                      <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200 font-mono text-xs">
                        {traj.observable_tool_calls.map((call, cIdx) => (
                          <div key={cIdx} className="text-indigo-900 flex items-start gap-2 break-all">
                            <span className="text-slate-400 select-none">{cIdx + 1}.</span>
                            {/* Render strictly as escaped plain text */}
                            <span>{call}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-white rounded-lg text-slate-500 text-xs italic font-mono border border-slate-200">
                        No observable tool calls executed (e.g. control question-only condition).
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedExperiment(null)}
              >
                Close Trajectory Viewer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Experiment Modal */}
      {showQueueModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="queue-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden text-slate-900">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <h3 id="queue-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
                Queue Controlled Experiment
              </h3>
              <button
                type="button"
                onClick={() => setShowQueueModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateExperiment} className="p-6 space-y-4">
              {formError && (
                <Alert variant="danger" title="Error">
                  {formError}
                </Alert>
              )}

              <div>
                <label htmlFor="exp-condition" className="block text-xs font-semibold text-slate-700 mb-1">
                  Experimental Condition <span className="text-red-600">*</span>
                </label>
                <div className="relative inline-flex items-center w-full">
                  <select
                    id="exp-condition"
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value as any)}
                    className="w-full appearance-none bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg pl-3 pr-8 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono cursor-pointer"
                  >
                    <option value="control">Control: question only, no web budget</option>
                    <option value="blind">Blind: permitted browsing, no benchmark identity</option>
                    <option value="evaluation_aware">Evaluation-Aware: permitted browsing + identity instruction</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" aria-hidden="true" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Blind describes what the system supplies, not guaranteed ignorance.
                </p>
              </div>

              <div>
                <label htmlFor="exp-model-id" className="block text-xs font-semibold text-slate-700 mb-1">
                  Pinned Model Identifier <span className="text-red-600">*</span>
                </label>
                <input
                  id="exp-model-id"
                  type="text"
                  required
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                  placeholder="e.g. gpt-4o-2026-08-06"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                />
              </div>

              <div>
                <label htmlFor="exp-model-rev" className="block text-xs font-semibold text-slate-700 mb-1">
                  Pinned Model Revision <span className="text-red-600">*</span>
                </label>
                <input
                  id="exp-model-rev"
                  type="text"
                  required
                  value={newModelRev}
                  onChange={(e) => setNewModelRev(e.target.value)}
                  placeholder="e.g. rev-1"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Record unavailable revision metadata as a reproducibility limitation.
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-800">Operational Safeguards:</div>
                <div>• Tool Policy: allowlisted_browsing_v1 with fresh session</div>
                <div>• Discovery version is frozen; no investigator cache is shared</div>
                <div>• Trusted grader outcome evaluated only after run completes</div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowQueueModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                  size="sm"
                >
                  {isSubmitting ? 'Queueing...' : 'Dispatch Experiment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
