import React, { useState } from 'react';
import { Sliders, ShieldCheck, Check, DollarSign, Clock, CheckCircle2, ChevronDown, ArrowRight } from 'lucide-react';
import type { EvaluationPolicyVersion, SourceFamily } from '@benchshield/api-client';
import { createPolicy } from '../../api/endpoints.js';
import { errorMessage, getSession } from '../../api/http.js';
import { zonedMidnightToIso } from '../../lib/time.js';
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

interface PolicyFormProps {
  activePolicy?: EvaluationPolicyVersion | null;
  onPolicyCreated?: (policy: EvaluationPolicyVersion) => void;
  onContinue?: () => void;
}

const SOURCE_CLASSES: { id: SourceFamily; label: string; desc: string }[] = [
  { id: 'web_search', label: 'Web Search', desc: 'General search results and pages' },
  { id: 'code_repository', label: 'Code Repositories', desc: 'Public code and release repositories' },
  { id: 'academic_archive', label: 'Academic Archives', desc: 'Papers and preprint servers' },
  { id: 'discussion_forum', label: 'Discussion Forums', desc: 'Q&A sites and forums' },
];

export function PolicyForm({ activePolicy, onPolicyCreated, onContinue }: PolicyFormProps) {
  const [name, setName] = useState('Demo public-benchmark exposure policy');
  const [cutoffDate, setCutoffDate] = useState('2024-01-01');
  const [timezone, setTimezone] = useState('UTC');
  const [allowedSources, setAllowedSources] = useState<SourceFamily[]>(['web_search', 'code_repository', 'academic_archive']);
  const [prohibitAnswerKeys, setProhibitAnswerKeys] = useState(true);
  const [benchmarkIdentPermitted, setBenchmarkIdentPermitted] = useState(false);
  const [dataClassification, setDataClassification] = useState<'public' | 'synthetic' | 'confidential'>('synthetic');

  const [budgets, setBudgets] = useState({
    max_queries_per_item: 3,
    max_fetches_per_item: 3,
    deadline_seconds: 600,
    cost_ceiling_usd: 5.0,
  });

  const [reviewerId, setReviewerId] = useState(getSession()?.label || 'maintainer@example.com');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdPolicy, setCreatedPolicy] = useState<EvaluationPolicyVersion | null>(activePolicy ?? null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleSource = (source: SourceFamily) => {
    setAllowedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const data = await createPolicy({
        name,
        evaluation_cutoff: zonedMidnightToIso(cutoffDate, timezone),
        cutoff_timezone: timezone,
        allowed_tools: ['search', 'fetch'],
        allowed_source_classes: allowedSources,
        prohibited_answer_key_access: prohibitAnswerKeys,
        benchmark_identification_permitted: benchmarkIdentPermitted,
        data_classification: dataClassification,
        reviewer_identity: reviewerId,
        max_concurrent_discovery_tasks: 2,
        retention_profile: 'pilot_standard_30_90',
        ...budgets,
      });
      setCreatedPolicy(data);
      onPolicyCreated?.(data);
    } catch (err) {
      setSubmitError(errorMessage(err));
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
          {submitError && (
            <Alert variant="danger" title="Policy was not created">
              {submitError}
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="policy-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Policy Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="policy-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={256}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                />
              </div>
              <div>
                <label htmlFor="data-classification" className="block text-xs font-semibold text-slate-700 mb-1">
                  Data Classification
                </label>
                <div className="relative inline-flex items-center w-full">
                  <select
                    id="data-classification"
                    value={dataClassification}
                    onChange={(e) => setDataClassification(e.target.value as typeof dataClassification)}
                    className="w-full appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                  >
                    <option value="synthetic">Synthetic</option>
                    <option value="public">Public</option>
                    <option value="confidential">Confidential (external discovery is policy-blocked)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" aria-hidden="true" />
                </div>
              </div>
            </div>

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SOURCE_CLASSES.map((src) => {
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
                    value={budgets.max_queries_per_item}
                    onChange={(e) =>
                      setBudgets({ ...budgets, max_queries_per_item: Number(e.target.value) })
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
                    max={50}
                    value={budgets.max_fetches_per_item}
                    onChange={(e) =>
                      setBudgets({ ...budgets, max_fetches_per_item: Number(e.target.value) })
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
                    max={86400}
                    step={60}
                    value={budgets.deadline_seconds}
                    onChange={(e) =>
                      setBudgets({ ...budgets, deadline_seconds: Number(e.target.value) })
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
                    min={0}
                    step={0.5}
                    value={budgets.cost_ceiling_usd}
                    onChange={(e) =>
                      setBudgets({ ...budgets, cost_ceiling_usd: Number(e.target.value) })
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
                <span className="font-normal text-slate-500"> (recorded on the policy; review decisions are attributed to the signed-in user)</span>
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
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="font-mono">
                    Version: {createdPolicy.policy_version_id} (Immutable)
                  </Badge>
                  {onContinue && (
                    <Button size="sm" onClick={onContinue} icon={<ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}>
                      Next: launch investigation
                    </Button>
                  )}
                </div>
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
                  Ceiling: <strong>${budgets.cost_ceiling_usd.toFixed(2)} USD</strong>
                </p>
                <p className="text-slate-500 text-[11px]">
                  Max {budgets.max_queries_per_item} queries, {budgets.max_fetches_per_item} fetches/item
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
