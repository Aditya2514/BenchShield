import { useState } from 'react';
import {
  ListFilter,
  Eye,
  CheckCircle2,
  AlertOctagon,
  Clock,
  ShieldCheck,
  X,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { getTemporalStatusMeta, getClaimStatusMeta } from '../../types/status.js';
import { ReviewDecisionModal } from '../reviews/ReviewDecisionModal.js';
import type { FindingItem, InvestigationResponse } from '@benchshield/api-client';

interface FindingsViewProps {
  initialFindings: FindingItem[];
  investigation: InvestigationResponse;
}

export function FindingsView({
  initialFindings,
  investigation,
}: FindingsViewProps) {
  const [findings, setFindings] = useState<FindingItem[]>(initialFindings);
  const [selectedFinding, setSelectedFinding] = useState<FindingItem | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [filterDimension, setFilterDimension] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = findings.filter((f) => {
    if (filterDimension !== 'all' && f.exposure_dimension !== filterDimension) {
      return false;
    }
    if (filterStatus !== 'all' && f.claim_status !== filterStatus) {
      return false;
    }
    return true;
  });

  const handleReviewUpdated = (updated: FindingItem) => {
    setFindings((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    if (selectedFinding?.id === updated.id) {
      setSelectedFinding(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Partial Coverage Warning Banner */}
      {investigation.partial_coverage && (
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
              {investigation.coverage_limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Policy Blocked Banner */}
      {investigation.state === 'policy_blocked' && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-rose-950/60 border border-rose-700/60 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-rose-200">
              Audit Execution Halted (policy_blocked)
            </h3>
            <p className="text-xs text-rose-300/90 mt-0.5">
              {investigation.failure_reason}
            </p>
          </div>
        </div>
      )}

      {/* Header and Dimension Filtering */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <ListFilter className="w-5 h-5 text-indigo-400" aria-hidden="true" />
              <h2 className="text-base font-bold text-white">
                Independent Finding Dimensions
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Investigation: <code className="text-slate-300">{investigation.id}</code> | Zero aggregated or opaque scores. Every dimension stands on independent evidence.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="filter-dim" className="text-slate-400">Dimension:</label>
            <select
              id="filter-dim"
              value={filterDimension}
              onChange={(e) => setFilterDimension(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1 text-slate-200"
            >
              <option value="all">All Dimensions</option>
              <option value="reference_answer">Reference Answer</option>
              <option value="worked_solution">Worked Solution</option>
              <option value="question_context">Question Context</option>
              <option value="metadata">Metadata</option>
            </select>

            <label htmlFor="filter-stat" className="text-slate-400 ml-2">Status:</label>
            <select
              id="filter-stat"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1 text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="verified">Verified</option>
              <option value="candidate">Candidate</option>
              <option value="needs_review">Needs Review</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Findings Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs font-mono">
            No findings match the selected independent filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th scope="col" className="py-2.5 px-3 font-medium">Item ID</th>
                  <th scope="col" className="py-2.5 px-3 font-medium">Status</th>
                  <th scope="col" className="py-2.5 px-3 font-medium">Exposure Type</th>
                  <th scope="col" className="py-2.5 px-3 font-medium">Task Identity</th>
                  <th scope="col" className="py-2.5 px-3 font-medium">Answer Match</th>
                  <th scope="col" className="py-2.5 px-3 font-medium">Temporal Status</th>
                  <th scope="col" className="py-2.5 px-3 font-medium">Policy</th>
                  <th scope="col" className="py-2.5 px-3 font-medium">Review</th>
                  <th scope="col" className="py-2.5 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((finding) => {
                  const claimMeta = getClaimStatusMeta(finding.claim_status);
                  const tempMeta = getTemporalStatusMeta(finding.temporal_status);

                  return (
                    <tr
                      key={finding.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        selectedFinding?.id === finding.id ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-semibold text-slate-200">
                        {finding.item_id}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${claimMeta.badgeClass}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                          {claimMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {finding.exposure_dimension}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {finding.task_identity}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {finding.answer_match}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${tempMeta.badgeClass}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                          {tempMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            finding.policy_compliance === 'violated'
                              ? 'bg-red-950 text-red-300 border border-red-800/50'
                              : finding.policy_compliance === 'permitted'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {finding.policy_compliance}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px]">
                        {finding.review_decision ? (
                          <span className="text-emerald-300 font-medium">
                            v{finding.version}: {finding.review_decision.action}
                          </span>
                        ) : (
                          <span className="text-slate-500">Unadjudicated</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedFinding(finding)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Finding Evidence Inspector Drawer */}
      {selectedFinding && (
        <section aria-labelledby="evidence-title" className="bg-slate-900 border border-indigo-900/60 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-400" aria-hidden="true" />
              <h3 id="evidence-title" className="text-sm font-bold text-white">
                Evidence Record: {selectedFinding.item_id} ({selectedFinding.evidence.snapshot_id})
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsReviewOpen(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Adjudicate Finding
              </button>
              <button
                onClick={() => setSelectedFinding(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200"
                aria-label="Close evidence inspector"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Source URL</span>
              <a
                href={selectedFinding.evidence.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:underline flex items-center gap-1 break-all"
              >
                {selectedFinding.evidence.source_url}
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Retrieval Timestamp
              </span>
              <span className="font-mono text-slate-200">
                {selectedFinding.evidence.retrieval_time}
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> Content Hash
              </span>
              <span className="font-mono text-slate-200 text-[11px] break-all">
                {selectedFinding.evidence.content_hash}
              </span>
            </div>
          </div>

          {/* Hard Rule 4: Plain text escaped excerpt viewer, NO dangerouslySetInnerHTML */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="raw-excerpt-viewer" className="text-xs font-medium text-slate-300">
                Raw Permitted Snapshot Excerpt (Untrusted text rendered escaped)
              </label>
              <span className="text-[11px] text-amber-400 flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5" aria-hidden="true" /> Plain Text Escaped Only
              </span>
            </div>
            <pre
              id="raw-excerpt-viewer"
              tabIndex={0}
              className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto selection:bg-indigo-600 focus:ring-2 focus:ring-indigo-500"
            >
              {selectedFinding.evidence.excerpt_text}
            </pre>
          </div>

          {/* Adjudication Decision History */}
          {selectedFinding.review_decision && (
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <span className="text-slate-400 font-medium">Recorded Adjudication Decision:</span>
              <p className="text-slate-200">
                Action: <strong>{selectedFinding.review_decision.action}</strong> by <code>{selectedFinding.review_decision.reviewer_id}</code> at {selectedFinding.review_decision.reviewed_at}
              </p>
              <p className="text-slate-400 text-[11px]">
                Reason: {selectedFinding.review_decision.reason}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Review Modal */}
      {selectedFinding && (
        <ReviewDecisionModal
          finding={selectedFinding}
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          onSuccess={handleReviewUpdated}
        />
      )}
    </div>
  );
}

