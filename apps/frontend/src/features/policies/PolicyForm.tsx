import React, { useState } from 'react';
import { Sliders, ShieldCheck, Check, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import type { PolicyResponse, BudgetCeilings } from '@benchshield/api-client';

interface PolicyFormProps {
  onPolicyCreated?: (policy: PolicyResponse) => void;
}

export function PolicyForm({ onPolicyCreated }: PolicyFormProps) {
  const [cutoffDate, setCutoffDate] = useState('2026-10-01');
  const [timezone, setTimezone] = useState('UTC');
  const [allowedSources, setAllowedSources] = useState<string[]>(['repository', 'research_web']);
  const [prohibitAnswerKeys, setProhibitAnswerKeys] = useState(true);
  const [benchmarkIdentPermitted, setBenchmarkIdentPermitted] = useState(false);

  const [budgets, setBudgets] = useState<BudgetCeilings>({
    max_search_queries_per_item: 3,
    max_fetched_pages_per_item: 5,
    max_deadline_seconds: 900,
    monetary_ceiling_usd: 15.0,
  });

  const [reviewerId, setReviewerId] = useState('rev-maintainer-01');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdPolicy, setCreatedPolicy] = useState<PolicyResponse | null>(null);

  const toggleSource = (source: string) => {
    setAllowedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cutoff_date: cutoffDate,
          timezone,
          allowed_source_classes: allowedSources,
          prohibited_answer_key_access: prohibitAnswerKeys,
          benchmark_identification_permitted: benchmarkIdentPermitted,
          budget_ceilings: budgets,
          reviewer_id: reviewerId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create evaluation policy');
      }

      const data: PolicyResponse = await response.json();
      setCreatedPolicy(data);
      onPolicyCreated?.(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2 bg-indigo-950 text-indigo-400 border border-indigo-700/50 rounded-lg">
            <Sliders className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Evaluation Policy & Privacy Scope</h2>
            <p className="text-xs text-slate-400">
              Configure cutoff dates, allowed tools, egress controls, and hard budget ceilings. Every policy version is immutable.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Temporal Cutoff Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cutoff-date" className="block text-xs font-medium text-slate-300">
                Evaluation Cutoff Date <span className="text-red-400">*</span>
              </label>
              <input
                id="cutoff-date"
                type="date"
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
                required
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Historical availability threshold for temporal verification.
              </span>
            </div>

            <div>
              <label htmlFor="timezone-select" className="block text-xs font-medium text-slate-300">
                Cutoff Timezone <span className="text-red-400">*</span>
              </label>
              <select
                id="timezone-select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
              </select>
            </div>
          </div>

          {/* Allowed Source Classes */}
          <div>
            <fieldset>
              <legend className="block text-xs font-medium text-slate-300">
                Allowed Source Classes
              </legend>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'repository', label: 'Public Repositories', desc: 'Code and release repositories' },
                  { id: 'research_web', label: 'Research Web', desc: 'ArXiv, docs, and search index' },
                  { id: 'conditional_mirror', label: 'Mirror Discovery', desc: 'Explicit mirror candidates' },
                ].map((src) => {
                  const checked = allowedSources.includes(src.id);
                  return (
                    <label
                      key={src.id}
                      className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-indigo-950/40 border-indigo-700/60 text-indigo-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{src.label}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSource(src.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 mt-1">{src.desc}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {/* Privacy & Egress Controls */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              Privacy & Invariant Rules
            </h3>
            <div className="space-y-2 text-xs text-slate-300">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prohibitAnswerKeys}
                  onChange={(e) => setProhibitAnswerKeys(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  <strong>Prohibit answer-key access</strong> (Flag any source reproducing full answer sheets as prohibited)
                </span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={benchmarkIdentPermitted}
                  onChange={(e) => setBenchmarkIdentPermitted(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  <strong>Benchmark identification permitted</strong> (Allow queries containing benchmark name)
                </span>
              </label>
            </div>
          </div>

          {/* Budget Ceilings */}
          <div>
            <h3 className="text-xs font-medium text-slate-300 mb-2">Budget Ceilings & Limits</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label htmlFor="max-queries" className="block text-[11px] text-slate-400">
                  Max Queries / Item
                </label>
                <input
                  id="max-queries"
                  type="number"
                  min={1}
                  max={20}
                  value={budgets.max_search_queries_per_item}
                  onChange={(e) =>
                    setBudgets({ ...budgets, max_search_queries_per_item: Number(e.target.value) })
                  }
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200"
                />
              </div>

              <div>
                <label htmlFor="max-pages" className="block text-[11px] text-slate-400">
                  Max Pages / Item
                </label>
                <input
                  id="max-pages"
                  type="number"
                  min={1}
                  max={30}
                  value={budgets.max_fetched_pages_per_item}
                  onChange={(e) =>
                    setBudgets({ ...budgets, max_fetched_pages_per_item: Number(e.target.value) })
                  }
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200"
                />
              </div>

              <div>
                <label htmlFor="deadline-sec" className="block text-[11px] text-slate-400">
                  Deadline (sec)
                </label>
                <input
                  id="deadline-sec"
                  type="number"
                  min={60}
                  step={60}
                  value={budgets.max_deadline_seconds}
                  onChange={(e) =>
                    setBudgets({ ...budgets, max_deadline_seconds: Number(e.target.value) })
                  }
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200"
                />
              </div>

              <div>
                <label htmlFor="monetary-ceiling" className="block text-[11px] text-slate-400">
                  Monetary Cap ($)
                </label>
                <input
                  id="monetary-ceiling"
                  type="number"
                  min={1}
                  step={0.5}
                  value={budgets.monetary_ceiling_usd}
                  onChange={(e) =>
                    setBudgets({ ...budgets, monetary_ceiling_usd: Number(e.target.value) })
                  }
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Reviewer ID */}
          <div>
            <label htmlFor="reviewer-id" className="block text-xs font-medium text-slate-300">
              Reviewer Identity
            </label>
            <input
              id="reviewer-id"
              type="text"
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
              required
              className="mt-1 w-full max-w-sm bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              {isSubmitting ? 'Creating Policy...' : 'Create Immutable Policy Version'}
            </button>
          </div>
        </form>
      </div>

      {/* Pre-Launch Review Summary Card */}
      <section aria-labelledby="policy-summary-title" className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            <h3 id="policy-summary-title" className="text-sm font-semibold text-white">
              Pre-Launch Policy & Privacy Review Summary
            </h3>
          </div>
          {createdPolicy && (
            <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-mono">
              Version: {createdPolicy.policy_version_id} (Immutable)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-slate-400 block font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" /> Temporal Threshold
            </span>
            <p className="text-slate-200">
              Cutoff: <strong>{cutoffDate}</strong> ({timezone})
            </p>
            <p className="text-slate-500 text-[11px]">Items verified prior to this are pre-cutoff.</p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-slate-400 block font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> Egress Destinations
            </span>
            <p className="text-slate-200">
              Allowed: <strong>{allowedSources.join(', ') || 'none'}</strong>
            </p>
            <p className="text-slate-500 text-[11px]">
              {prohibitAnswerKeys ? 'Answer keys strictly prohibited' : 'Key access permitted'}
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-slate-400 block font-medium flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" /> Budget Cap
            </span>
            <p className="text-slate-200">
              Ceiling: <strong>${budgets.monetary_ceiling_usd.toFixed(2)} USD</strong>
            </p>
            <p className="text-slate-500 text-[11px]">
              Max {budgets.max_search_queries_per_item} queries, {budgets.max_fetched_pages_per_item} pages/item
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

