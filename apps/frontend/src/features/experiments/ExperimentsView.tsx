import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Play,
  Terminal,
  X,
} from 'lucide-react';
import type { ExperimentItem } from '@benchshield/api-client';

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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            [–] None
          </span>
        );
      case 'retrieval_observed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-950/70 text-amber-300 border border-amber-700/60">
            [~] Retrieval Observed
          </span>
        );
      case 'use_supported':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-950/70 text-blue-300 border border-blue-700/60">
            [!] Use Supported
          </span>
        );
      case 'intervention_supported':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-950/70 text-purple-300 border border-purple-700/60">
            [*] Intervention Supported
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400">
            {strength}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <section aria-labelledby="experiments-title" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-purple-400 uppercase tracking-wider">
                ADR-001 Optional Comparative Evaluation
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                Isolated Attacker
              </span>
            </div>
            <h2 id="experiments-title" className="text-xl font-bold text-white mt-1">
              Controlled Attacker Experiments
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Compare model performance under strictly controlled web conditions (Control vs Blind vs Evaluation-Aware). A failed experiment does not invalidate an otherwise complete exposure audit.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowQueueModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-white text-sm font-medium transition"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            Queue Controlled Experiment
          </button>
        </div>

        {/* Stratification Rule Notice */}
        <div
          role="note"
          className="mt-4 p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300 flex items-start gap-2.5"
        >
          <Layers className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="text-slate-100">Stratified Configuration Invariant:</strong> Results are strictly grouped by pinned model identifier and revision. They are never pooled across different configurations. Incomplete runs are explicitly excluded from accuracy denominators.
          </div>
        </div>
      </section>

      {/* Loading & Error States */}
      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-2" />
          <p className="text-sm">Loading controlled experiments...</p>
        </div>
      )}

      {error && (
        <div role="alert" className="bg-red-950/60 border border-red-700/60 rounded-xl p-4 text-red-200 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="font-semibold text-red-200">Failed to Load Experiments</h3>
            <p className="text-xs text-red-300 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && experiments.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Cpu className="w-10 h-10 text-slate-600 mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-base font-semibold text-slate-200">No Experiments Recorded</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
            No comparative attacker runs have been dispatched for this investigation yet. Queue an experiment to test live browsing vs control.
          </p>
          <button
            type="button"
            onClick={() => setShowQueueModal(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            Queue Controlled Experiment
          </button>
        </div>
      )}

      {/* Stratified Groups */}
      {!loading &&
        configKeys.map((configKey) => {
          const groupExps = groupedByConfig[configKey];
          const firstExp = groupExps[0];

          return (
            <div
              key={configKey}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm"
              data-testid={`config-group-${firstExp.model_identifier}`}
            >
              {/* Group Header: Pinned Configuration Summary */}
              <div className="bg-slate-850 px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-950 border border-indigo-800/60 rounded-lg text-indigo-400">
                    <Cpu className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase text-indigo-400">Pinned Configuration</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        Stratified
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white mt-0.5">
                      Model: <span className="font-mono text-indigo-300">{firstExp.model_identifier}</span>
                      <span className="text-slate-400 font-normal ml-2">
                        (Revision: <span className="font-mono text-slate-300">{firstExp.model_revision}</span>)
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <div>
                    <span className="block text-slate-500 text-[10px] uppercase font-mono">Tool Policy</span>
                    <span className="text-slate-300 font-mono">allowlisted_browsing_v1</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[10px] uppercase font-mono">Reasoning Budget</span>
                    <span className="text-slate-300 font-mono">standard</span>
                  </div>
                </div>
              </div>

              {/* Condition Comparison Table with Explicit Denominators */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-mono text-[11px]">
                      <th scope="col" className="py-3 px-4">Condition</th>
                      <th scope="col" className="py-3 px-4">Status</th>
                      <th scope="col" className="py-3 px-4">Completed Runs</th>
                      <th scope="col" className="py-3 px-4">Incomplete Runs</th>
                      <th scope="col" className="py-3 px-4">Correct Answer Count &amp; Rate</th>
                      <th scope="col" className="py-3 px-4">Prohibited Retrieval</th>
                      <th scope="col" className="py-3 px-4">Attribution Strength</th>
                      <th scope="col" className="py-3 px-4 text-right">Trajectories</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
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
                        <tr key={exp.experiment_id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <span className="font-mono text-indigo-400 text-xs block">
                              {getConditionLabel(exp.condition)}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ID: {exp.experiment_id}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                              {exp.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            <span className="text-slate-100 font-bold">{exp.completed_run_count}</span>
                            <span className="text-slate-400"> / {totalRuns}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            {exp.incomplete_run_count > 0 ? (
                              <span className="text-amber-400 font-bold">
                                {exp.incomplete_run_count} (Excluded)
                              </span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            <div>
                              <span className="text-slate-100 font-bold">
                                {exp.correct_answer_count} / {exp.completed_run_count}
                              </span>{' '}
                              <span className="text-slate-400 font-normal">({accuracyRate}%)</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block">
                              Denominator excludes {exp.incomplete_run_count} incomplete
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            <div>
                              <span className="text-slate-100 font-bold">
                                {exp.prohibited_retrieval_count} / {exp.completed_run_count}
                              </span>{' '}
                              <span className="text-slate-400 font-normal">({retrievalRate}%)</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {getAttributionBadge(exp.attribution_strength)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedExperiment(exp)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-slate-700 text-xs font-mono transition"
                              aria-label={`View trajectories for ${getConditionLabel(exp.condition)}`}
                            >
                              <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
                              Inspect ({exp.trajectories?.length || 0})
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Explicit Denominators Footnote */}
              <div className="bg-slate-900/80 px-5 py-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <strong>Denominators Invariant:</strong> Incomplete runs (e.g. timeout, provider rate limit) are strictly excluded from accuracy denominators and reported as separate counts. Never treat incomplete runs as incorrect answers or substitute fallback models into a comparative condition.
                </div>
              </div>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase text-indigo-400">Observable Trajectory Viewer</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    Untrusted Content
                  </span>
                </div>
                <h3 id="trajectory-modal-title" className="text-lg font-bold text-white mt-0.5">
                  Condition: {getConditionLabel(selectedExperiment.condition)} ({selectedExperiment.experiment_id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExperiment(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                aria-label="Close trajectory viewer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Privacy Rule Banner */}
            <div className="bg-indigo-950/40 border-b border-indigo-900/50 px-6 py-2.5 text-xs text-indigo-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden="true" />
              <span>
                <strong>Privacy Invariant:</strong> Private model reasoning (chain-of-thought) is never recorded or displayed. Only observable tool calls, fetched content, and trusted grader outcomes are recorded.
              </span>
            </div>

            {/* Trajectory Runs List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {(!selectedExperiment.trajectories || selectedExperiment.trajectories.length === 0) && (
                <div className="p-8 text-center text-slate-400 text-xs font-mono">
                  No trajectories recorded for this experiment run.
                </div>
              )}

              {selectedExperiment.trajectories?.map((traj, idx) => (
                <div
                  key={traj.run_id || idx}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3"
                  data-testid={`trajectory-run-${traj.run_id}`}
                >
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white">
                        Run: {traj.run_id}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        Status: {traj.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Grader Outcome:</span>
                      <span
                        className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                          traj.grader_outcome === 'correct'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : traj.grader_outcome === 'incorrect'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {traj.grader_outcome}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block mb-1">
                      Observable Tool Calls ({traj.observable_tool_calls?.length || 0}):
                    </span>
                    {traj.observable_tool_calls && traj.observable_tool_calls.length > 0 ? (
                      <div className="space-y-1.5 bg-slate-900/90 p-3 rounded-lg border border-slate-800 font-mono text-xs">
                        {traj.observable_tool_calls.map((call, cIdx) => (
                          <div key={cIdx} className="text-indigo-300 flex items-start gap-2 break-all">
                            <span className="text-slate-600 select-none">{cIdx + 1}.</span>
                            {/* Render strictly as escaped plain text */}
                            <span>{call}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-900/50 rounded-lg text-slate-500 text-xs italic font-mono">
                        No observable tool calls executed (e.g. control question-only condition).
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-850 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedExperiment(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition"
              >
                Close Trajectory Viewer
              </button>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <h3 id="queue-modal-title" className="text-lg font-bold text-white">
                Queue Controlled Experiment
              </h3>
              <button
                type="button"
                onClick={() => setShowQueueModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateExperiment} className="p-6 space-y-4">
              {formError && (
                <div role="alert" className="p-3 bg-red-950/60 border border-red-700/60 rounded-lg text-xs text-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="exp-condition" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Experimental Condition
                </label>
                <select
                  id="exp-condition"
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                >
                  <option value="control">Control: question only, no web budget</option>
                  <option value="blind">Blind: permitted browsing, no benchmark identity</option>
                  <option value="evaluation_aware">Evaluation-Aware: permitted browsing + identity instruction</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Blind describes what the system supplies, not guaranteed ignorance.
                </p>
              </div>

              <div>
                <label htmlFor="exp-model-id" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Pinned Model Identifier
                </label>
                <input
                  id="exp-model-id"
                  type="text"
                  required
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                  placeholder="e.g. gpt-4o-2026-08-06"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label htmlFor="exp-model-rev" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Pinned Model Revision
                </label>
                <input
                  id="exp-model-rev"
                  type="text"
                  required
                  value={newModelRev}
                  onChange={(e) => setNewModelRev(e.target.value)}
                  placeholder="e.g. rev-1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Record unavailable revision metadata as a reproducibility limitation.
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Operational Safeguards:</div>
                <div>• Tool Policy: allowlisted_browsing_v1 with fresh session</div>
                <div>• Discovery version is frozen; no investigator cache is shared</div>
                <div>• Trusted grader outcome evaluated only after run completes</div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowQueueModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Queueing...' : 'Dispatch Experiment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
