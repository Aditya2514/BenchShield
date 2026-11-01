import { useCallback, useEffect, useState } from 'react';
import { Eye, X, ListFilter } from 'lucide-react';
import type { ClaimStatus, ExposureType, FindingView, InvestigationStatusResponse, ReviewDecision } from '@benchshield/api-client';
import { getInvestigation, getReviewHistory, listFindings } from '../../api/endpoints.js';
import { errorMessage } from '../../api/http.js';
import { getTemporalStatusMeta, getClaimStatusMeta } from '../../types/status.js';
import { ReviewDecisionModal } from '../reviews/ReviewDecisionModal.js';
import { CoverageWarning } from '../investigations/CoverageWarning.js';
import type { NavTab } from '../../components/Shell.js';
import { formatDateTime } from '../../lib/time.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Alert, EmptyState, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui';

export function FindingsView({ investigationId, onNavigate }: { investigationId: string | null; onNavigate?: (t: NavTab) => void }) {
  const [findings, setFindings] = useState<FindingView[]>([]);
  const [inv, setInv] = useState<InvestigationStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dim, setDim] = useState<'' | ExposureType>('');
  const [stat, setStat] = useState<'' | ClaimStatus>('');
  const [selected, setSelected] = useState<FindingView | null>(null);
  const [history, setHistory] = useState<ReviewDecision[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    if (!investigationId) return;
    setLoading(true);
    try {
      const [i, f] = await Promise.all([
        getInvestigation(investigationId),
        listFindings(investigationId, { exposure_type: dim || undefined, claim_status: stat || undefined }),
      ]);
      setInv(i);
      setFindings(f.items ?? []);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [investigationId, dim, stat]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selected) return;
    getReviewHistory(selected.finding_id).then((h) => setHistory(h.decisions ?? [])).catch(() => setHistory([]));
  }, [selected]);

  if (!investigationId) {
    return <EmptyState icon={<ListFilter className="w-6 h-6" aria-hidden="true" />} title="No investigation selected" description="Launch or open an investigation, then run verification to create findings." action={<Button onClick={() => onNavigate?.('investigations')}>Go to investigations</Button>} />;
  }

  const onUpdated = (u: FindingView) => {
    setFindings((prev) => prev.map((f) => (f.finding_id === u.finding_id ? u : f)));
    setSelected(u);
  };

  return (
    <div className="space-y-6">
      {error && <Alert variant="danger" title="Could not load findings">{error}</Alert>}
      {inv && <CoverageWarning investigation={inv} />}
      {inv && ['policy_blocked', 'failed'].includes(inv.status) && (
        <Alert variant="danger" title={`Audit Execution Halted (${inv.status})`}>No findings exist for items that were not investigated.</Alert>
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div>
              <CardTitle>Independent Finding Dimensions</CardTitle>
              <CardDescription>Investigation <code>{investigationId}</code>. No aggregated score: each dimension stands on its own evidence.</CardDescription>
            </div>
            <div className="flex gap-3 text-xs">
              <label className="flex items-center gap-1.5 font-semibold">Dimension:
                <select aria-label="Dimension" value={dim} onChange={(e) => setDim(e.target.value as ExposureType | '')} className="border rounded-lg px-2 py-1">
                  <option value="">All Dimensions</option><option value="reference_answer">Reference Answer</option><option value="worked_solution">Worked Solution</option><option value="question_context">Question Context</option><option value="metadata">Metadata</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 font-semibold">Status:
                <select aria-label="Status" value={stat} onChange={(e) => setStat(e.target.value as ClaimStatus | '')} className="border rounded-lg px-2 py-1">
                  <option value="">All Statuses</option><option value="verified">Verified</option><option value="candidate">Candidate</option><option value="needs_review">Needs Review</option><option value="rejected">Rejected</option>
                </select>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && findings.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">Loading findings...</div>
          ) : findings.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">No findings. If discovery has finished, run verification on the Investigations tab.</div>
          ) : (
            <Table>
              <TableHeader><tr><TableHead>Item</TableHead><TableHead>Status</TableHead><TableHead>Exposure</TableHead><TableHead>Task Identity</TableHead><TableHead>Answer Match</TableHead><TableHead>Temporal</TableHead><TableHead>Review</TableHead><TableHead className="text-right">Actions</TableHead></tr></TableHeader>
              <TableBody>
                {findings.map((f) => {
                  const c = getClaimStatusMeta(f.claim.claim_status ?? 'candidate');
                  const t = getTemporalStatusMeta(f.temporal.temporal_status ?? 'unknown');
                  return (
                    <TableRow key={f.finding_id}>
                      <TableCell className="font-mono font-bold">{f.external_id}</TableCell>
                      <TableCell><span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c.badgeClass}`}>{c.label}</span></TableCell>
                      <TableCell className="font-mono">{f.claim.exposure_type}</TableCell>
                      <TableCell>{f.verification.task_identity}</TableCell>
                      <TableCell>{f.verification.answer_match}</TableCell>
                      <TableCell><span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${t.badgeClass}`}>{t.label}</span></TableCell>
                      <TableCell className="text-xs">{f.current_reviewer_decision ? `v${f.version}: ${f.current_reviewer_decision}` : 'Unadjudicated'}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="secondary" onClick={() => setSelected(f)} icon={<Eye className="w-3.5 h-3.5" aria-hidden="true" />}>Inspect</Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <section aria-labelledby="evidence-title">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <h3 id="evidence-title" className="text-sm font-bold">Evidence Record: {selected.external_id} ({selected.snapshot.snapshot_id})</h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setReviewOpen(true)}>Adjudicate Finding</Button>
                  <button type="button" onClick={() => setSelected(null)} aria-label="Close evidence inspector" className="p-1.5 cursor-pointer"><X className="w-4 h-4" aria-hidden="true" /></button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><b>Source URL</b><div className="break-all font-mono">{selected.snapshot.source_url}</div><div className="text-slate-500">{selected.snapshot.source_family}</div></div>
                <div><b>Retrieved</b><div className="font-mono">{formatDateTime(selected.snapshot.retrieved_at)}</div></div>
                <div><b>Content Hash</b><div className="font-mono break-all">{selected.snapshot.content_hash}</div></div>
              </div>
              <p><b>Rationale:</b> {selected.claim.rationale}</p>
              <p><b>Grader:</b> {selected.verification.explanation}</p>
              {selected.temporal.supporting_evidence_note && <p><b>Timing:</b> {selected.temporal.supporting_evidence_note}</p>}
              <div>
                <div className="flex justify-between font-semibold mb-1"><span>Snapshot excerpt (untrusted, rendered as plain text)</span><span className="text-amber-800">Plain Text Escaped Only</span></div>
                <pre tabIndex={0} className="p-4 rounded-xl bg-slate-50 border whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{selected.snapshot.raw_content_preview ?? '(no preview stored)'}</pre>
              </div>
              <div>
                <b>Review history (append-only)</b>
                {history.length === 0 ? <p className="text-slate-500">No decisions yet.</p> : (
                  <ul className="list-disc list-inside">{history.map((d) => <li key={d.decision_id}>v{d.expected_version}→v{d.new_version}: <b>{d.action}</b> by <code>{d.reviewer_id}</code> — {d.reason}</li>)}</ul>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
      {selected && <ReviewDecisionModal finding={selected} isOpen={reviewOpen} onClose={() => setReviewOpen(false)} onSuccess={onUpdated} />}
    </div>
  );
}
