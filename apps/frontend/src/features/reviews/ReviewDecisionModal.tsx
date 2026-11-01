import React, { useState } from 'react';
import { Check, X, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { FindingItem } from '@benchshield/api-client';

interface ReviewDecisionModalProps {
  finding: FindingItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedFinding: FindingItem) => void;
}

export function ReviewDecisionModal({
  finding,
  isOpen,
  onClose,
  onSuccess,
}: ReviewDecisionModalProps) {
  const [action, setAction] = useState<'confirmed' | 'rejected' | 'needs_more_evidence'>('confirmed');
  const [reason, setReason] = useState('Source explicitly matches task wording and maps answer to correct option.');
  const [reviewerId, setReviewerId] = useState('rev-maintainer-01');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setConflictError(null);

    try {
      const res = await fetch(`/api/v1/findings/${finding.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_version: finding.version,
          action,
          reason,
          reviewer_id: reviewerId,
        }),
      });

      if (res.status === 409) {
        const err = await res.json();
        setConflictError(err.message || 'Version conflict (409): Another reviewer updated this finding.');
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to record review decision.');
      }

      const updated = await res.json();
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setConflictError(err.message || 'Network error recording decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            <h3 id="review-dialog-title" className="text-sm font-bold text-white">
              Adjudicate Finding: {finding.item_id}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* 409 Conflict Alert */}
        {conflictError && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-amber-950/80 border border-amber-700/80 text-amber-200 text-xs flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Version Conflict (409 Conflict)</p>
              <p className="mt-0.5 text-amber-300/90">{conflictError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Adjudication Action
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: 'confirmed' as const, label: 'Confirm Exposure' },
                { id: 'rejected' as const, label: 'Reject Match' },
                { id: 'needs_more_evidence' as const, label: 'Needs Evidence' },
              ].map((act) => (
                <button
                  type="button"
                  key={act.id}
                  onClick={() => setAction(act.id)}
                  className={`py-2 px-2.5 rounded-lg border text-center font-medium transition-colors ${
                    action === act.id
                      ? 'bg-indigo-950 border-indigo-600 text-indigo-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="adjudication-reason" className="block text-xs font-medium text-slate-300 mb-1">
              Decision Justification / Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              id="adjudication-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500 font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label htmlFor="modal-reviewer-id" className="block text-slate-400 mb-1">Reviewer ID</label>
              <input
                id="modal-reviewer-id"
                type="text"
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs"
              />
            </div>
            <div>
              <label htmlFor="expected-version" className="block text-slate-400 mb-1">Target Version Lock</label>
              <input
                id="expected-version"
                type="number"
                value={finding.version}
                readOnly
                className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-400 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              {isSubmitting ? 'Recording...' : 'Record Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

