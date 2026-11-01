import React, { useState } from 'react';
import { Sliders, ShieldCheck, Check, DollarSign, Clock, CheckCircle2, ChevronDown } from 'lucide-react';
import type { PolicyResponse, BudgetCeilings } from '@benchshield/api-client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from '../../components/ui';

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
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg shrink-0">
              <Sliders className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Evaluation Policy &amp; Privacy Scope</CardTitle>
              <CardDescription>
                Configure cutoff dates, allowed tools, egress controls, and hard budget ceilings. Every policy version is immutable.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Temporal Cutoff Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="cutoff-date" className="block text-xs font-semibold text-slate-700 mb-1">
                  Evaluation Cutoff Date <span className="text-red-600">*</span>
                </label>
                <input
                  id="cutoff-date"
                  type="date"
                  value={cutoffDate}
                  onChange={(e) => setCutoffDate(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Historical availability threshold for temporal verification.
                </span>
              </div>

              <div>
                <label htmlFor="timezone-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Cutoff Timezone <span className="text-red-600">*</span>
                </label>
                <div className="relative inline-flex items-center w-full">
                  <select
                    id="timezone-select"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full appearance-none bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg pl-3 pr-8 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" aria-hidden="true" />
                </div>
              </div>
            </div>

            {/* Allowed Source Classes */}
            <div>
              <fieldset>
                <legend className="block text-xs font-semibold text-slate-700 mb-2">
                  Allowed Source Classes
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'repository', label: 'Public Repositories', desc: 'Code and release repositories' },
                    { id: 'research_web', label: 'Research Web', desc: 'ArXiv, docs, and search index' },
                    { id: 'conditional_mirror', label: 'Mirror Discovery', desc: 'Explicit mirror candidates' },
                  ].map((src) => {
                    const checked = allowedSources.includes(src.id);
                    return (
                      <label
                        key={src.id}
                        className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                          checked
                            ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-2xs ring-1 ring-indigo-300'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">{src.label}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSource(src.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-600"
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
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                Privacy &amp; Invariant Rules
              </h3>
              <div className="space-y-2.5 text-xs text-slate-700">
                <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={prohibitAnswerKeys}
                    onChange={(e) => setProhibitAnswerKeys(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-600"
                  />
                  <span>
                    <strong>Prohibit answer-key access</strong> (Flag any source reproducing full answer sheets as prohibited)
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={benchmarkIdentPermitted}
                    onChange={(e) => setBenchmarkIdentPermitted(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-600"
                  />
                  <span>
                    <strong>Benchmark identification permitted</strong> (Allow queries containing benchmark name)
                  </span>
                </label>
              </div>
            </div>

            {/* Budget Ceilings */}
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2">Budget Ceilings &amp; Limits</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="max-queries" className="block text-[11px] font-semibold text-slate-600 mb-1">
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
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label htmlFor="max-pages" className="block text-[11px] font-semibold text-slate-600 mb-1">
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
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label htmlFor="deadline-sec" className="block text-[11px] font-semibold text-slate-600 mb-1">
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
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label htmlFor="monetary-ceiling" className="block text-[11px] font-semibold text-slate-600 mb-1">
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
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>
            </div>

            {/* Reviewer ID */}
            <div>
              <label htmlFor="reviewer-id" className="block text-xs font-semibold text-slate-700 mb-1">
                Reviewer Identity <span className="text-red-600">*</span>
              </label>
              <input
                id="reviewer-id"
                type="text"
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
                required
                className="w-full max-w-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                variant="primary"
                icon={<Check className="w-4 h-4" aria-hidden="true" />}
              >
                {isSubmitting ? 'Creating Policy...' : 'Create Immutable Policy Version'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Pre-Launch Review Summary Card */}
      <section aria-labelledby="policy-summary-title">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                <h3 id="policy-summary-title" className="text-base font-semibold text-slate-900">
                  Pre-Launch Policy &amp; Privacy Review Summary
                </h3>
              </div>
              {createdPolicy && (
                <Badge variant="success" className="font-mono">
                  Version: {createdPolicy.policy_version_id} (Immutable)
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                <span className="text-slate-600 block font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-500" aria-hidden="true" /> Temporal Threshold
                </span>
                <p className="text-slate-900 font-medium">
                  Cutoff: <strong>{cutoffDate}</strong> ({timezone})
                </p>
                <p className="text-slate-500 text-[11px]">Items verified prior to this are pre-cutoff.</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                <span className="text-slate-600 block font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" /> Egress Destinations
                </span>
                <p className="text-slate-900 font-medium">
                  Allowed: <strong>{allowedSources.join(', ') || 'none'}</strong>
                </p>
                <p className="text-slate-500 text-[11px]">
                  {prohibitAnswerKeys ? 'Answer keys strictly prohibited' : 'Key access permitted'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                <span className="text-slate-600 block font-semibold flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-indigo-600" aria-hidden="true" /> Budget Cap
                </span>
                <p className="text-slate-900 font-medium">
                  Ceiling: <strong>${budgets.monetary_ceiling_usd.toFixed(2)} USD</strong>
                </p>
                <p className="text-slate-500 text-[11px]">
                  Max {budgets.max_search_queries_per_item} queries, {budgets.max_fetched_pages_per_item} pages/item
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
