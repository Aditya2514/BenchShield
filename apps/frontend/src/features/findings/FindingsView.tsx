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
} from 'lucide-react';
import { getTemporalStatusMeta, getClaimStatusMeta } from '../../types/status.js';
import { ReviewDecisionModal } from '../reviews/ReviewDecisionModal.js';
import type { FindingItem, InvestigationResponse } from '@benchshield/api-client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../../components/ui';

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
        <Alert variant="warning" title="Partial Coverage Audit Warning">
          <p className="mt-0.5">
            This investigation encountered provider limits or outages. Incomplete coverage must never be interpreted as an unexposed or clean certification.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-900 list-disc list-inside font-medium">
            {investigation.coverage_limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Policy Blocked Banner */}
      {investigation.state === 'policy_blocked' && (
        <Alert variant="danger" title="Audit Execution Halted (policy_blocked)">
          <p className="mt-0.5">{investigation.failure_reason}</p>
        </Alert>
      )}

      {/* Header and Dimension Filtering */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div>
              <div className="flex items-center gap-2">
                <ListFilter className="w-5 h-5 text-indigo-700" aria-hidden="true" />
                <CardTitle>Independent Finding Dimensions</CardTitle>
              </div>
              <CardDescription>
                Investigation: <code className="text-slate-800 font-semibold">{investigation.id}</code> | Zero aggregated or opaque scores. Every dimension stands on independent evidence.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <label htmlFor="filter-dim" className="font-semibold text-slate-700">Dimension:</label>
                <select
                  id="filter-dim"
                  value={filterDimension}
                  onChange={(e) => setFilterDimension(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="all">All Dimensions</option>
                  <option value="reference_answer">Reference Answer</option>
                  <option value="worked_solution">Worked Solution</option>
                  <option value="question_context">Question Context</option>
                  <option value="metadata">Metadata</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="filter-stat" className="font-semibold text-slate-700">Status:</label>
                <select
                  id="filter-stat"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="all">All Statuses</option>
                  <option value="verified">Verified</option>
                  <option value="candidate">Candidate</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs font-mono">
              No findings match the selected independent filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Item ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Exposure Type</TableHead>
                  <TableHead>Task Identity</TableHead>
                  <TableHead>Answer Match</TableHead>
                  <TableHead>Temporal Status</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {filtered.map((finding) => {
                  const claimMeta = getClaimStatusMeta(finding.claim_status);
                  const tempMeta = getTemporalStatusMeta(finding.temporal_status);

                  return (
                    <TableRow
                      key={finding.id}
                      className={selectedFinding?.id === finding.id ? 'bg-indigo-50/60' : ''}
                    >
                      <TableCell className="font-mono font-bold text-slate-900">
                        {finding.item_id}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${claimMeta.badgeClass}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                          {claimMeta.label}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-slate-700">
                        {finding.exposure_dimension}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {finding.task_identity}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {finding.answer_match}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${tempMeta.badgeClass}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                          {tempMeta.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            finding.policy_compliance === 'violated'
                              ? 'danger'
                              : finding.policy_compliance === 'permitted'
                              ? 'success'
                              : 'neutral'
                          }
                        >
                          {finding.policy_compliance}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {finding.review_decision ? (
                          <span className="text-emerald-700 font-semibold">
                            v{finding.version}: {finding.review_decision.action}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">Unadjudicated</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedFinding(finding)}
                          icon={<Eye className="w-3.5 h-3.5" aria-hidden="true" />}
                        >
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Selected Finding Evidence Inspector Drawer */}
      {selectedFinding && (
        <section aria-labelledby="evidence-title">
          <Card className="border-indigo-200 shadow-md">
            <CardHeader className="bg-indigo-50/40 border-b border-indigo-100">
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-700" aria-hidden="true" />
                  <h3 id="evidence-title" className="text-sm font-bold text-slate-900 tracking-tight">
                    Evidence Record: {selectedFinding.item_id} ({selectedFinding.evidence.snapshot_id})
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsReviewOpen(true)}
                    icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
                  >
                    Adjudicate Finding
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSelectedFinding(null)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                    aria-label="Close evidence inspector"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Compact Evidence Metadata Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-semibold block mb-1">Source URL</span>
                  <a
                    href={selectedFinding.evidence.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-700 font-medium hover:underline flex items-center gap-1 break-all"
                  >
                    {selectedFinding.evidence.source_url}
                    <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                  </a>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-semibold block mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" /> Retrieval Timestamp
                  </span>
                  <span className="font-mono text-slate-800 font-medium">
                    {selectedFinding.evidence.retrieval_time}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-semibold block mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> Content Hash
                  </span>
                  <span className="font-mono text-slate-800 font-medium text-[11px] break-all">
                    {selectedFinding.evidence.content_hash}
                  </span>
                </div>
              </div>

              {/* Hard Rule 4: Plain text escaped excerpt viewer, NO dangerouslySetInnerHTML */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="raw-excerpt-viewer" className="text-xs font-semibold text-slate-700">
                    Raw Permitted Snapshot Excerpt (Untrusted text rendered escaped)
                  </label>
                  <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                    <AlertOctagon className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" /> Plain Text Escaped Only
                  </span>
                </div>
                <pre
                  id="raw-excerpt-viewer"
                  tabIndex={0}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 font-mono text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto selection:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-2xs"
                >
                  {selectedFinding.evidence.excerpt_text}
                </pre>
              </div>

              {/* Adjudication Decision History */}
              {selectedFinding.review_decision && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <span className="text-slate-600 font-bold">Recorded Adjudication Decision:</span>
                  <p className="text-slate-900 font-medium">
                    Action: <strong>{selectedFinding.review_decision.action}</strong> by <code>{selectedFinding.review_decision.reviewer_id}</code> at {selectedFinding.review_decision.reviewed_at}
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    Reason: {selectedFinding.review_decision.reason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
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
