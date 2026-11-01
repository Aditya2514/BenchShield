import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { FindingView, ReviewAction } from '@benchshield/api-client';
import { submitReview, getFinding } from '../../api/endpoints.js';
import { ApiError, errorMessage } from '../../api/http.js';
import { Button, Alert } from '../../components/ui';

interface Props {
  finding: FindingView;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: FindingView) => void;
}

export function ReviewDecisionModal({ finding, isOpen, onClose, onSuccess }: Props) {
  const [action, setAction] = useState<ReviewAction>('confirm');
  const [reason, setReason] = useState('Source matches the task wording and the reference answer.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; msg: string } | null>(null);
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitReview(finding.finding_id, { expected_version: finding.version ?? 1, action, reason });
      onSuccess(await getFinding(finding.finding_id));
      onClose();
    } catch (err) {
      const title = err instanceof ApiError && err.status === 409 ? 'Version Conflict (409 Conflict)' : 'Decision not recorded';
      setError({ title, msg: errorMessage(err) });
      if (err instanceof ApiError && err.status === 409) onSuccess(await getFinding(finding.finding_id));
    } finally {
      setBusy(false);
    }
  };

  const options: { id: ReviewAction; label: string }[] = [
    { id: 'confirm', label: 'Confirm Exposure' },
    { id: 'reject', label: 'Reject Match' },
    { id: 'request_more_evidence', label: 'Needs Evidence' },
  ];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="review-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="review-dialog-title" className="text-base font-bold">Adjudicate Finding: {finding.external_id}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="p-1.5 cursor-pointer"><X className="w-4 h-4" aria-hidden="true" /></button>
        </div>
        {error && <Alert variant="warning" title={error.title}>{error.msg}</Alert>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset>
            <legend className="text-xs font-semibold text-slate-700 mb-2">Adjudication Action</legend>
            <div className="grid grid-cols-3 gap-2">
              {options.map((o) => (
                <label key={o.id} className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${action === o.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                  <input type="radio" name="action" className="sr-only" checked={action === o.id} onChange={() => setAction(o.id)} />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="adjudication-reason" className="block text-xs font-semibold text-slate-700 mb-1">Decision Justification / Reason</label>
            <textarea id="adjudication-reason" rows={3} required value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 text-xs" />
          </div>
          <p className="text-xs text-slate-500">Expected version: <code>{finding.version}</code>. Recorded as the signed-in user; decisions are append-only.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy}>{busy ? 'Recording...' : 'Record Decision'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
