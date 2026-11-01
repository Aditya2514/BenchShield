import React, { useState } from 'react';
import { Check, X, ShieldAlert, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import type { FindingItem } from '@benchshield/api-client';
import { Button, Alert } from '../../components/ui';

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

  const actionOptions = [
    {
      id: 'confirmed' as const,
      label: 'Confirm Exposure',
      description: 'Flag finding as verified exposure claim',
      icon: CheckCircle2,
      activeColor: 'border-red-400 bg-red-50 text-red-950 ring-1 ring-red-400',
    },
    {
      id: 'rejected' as const,
      label: 'Reject Match',
      description: 'Classify as false positive or incidental overlap',
      icon: XCircle,
      activeColor: 'border-slate-400 bg-slate-100 text-slate-900 ring-1 ring-slate-400',
    },
    {
      id: 'needs_more_evidence' as const,
      label: 'Needs Evidence',
      description: 'Requires deeper secondary crawl or mirror check',
      icon: HelpCircle,
      activeColor: 'border-purple-400 bg-purple-50 text-purple-950 ring-1 ring-purple-400',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 id="review-dialog-title" className="text-base font-bold text-slate-900">
              Adjudicate Finding: {finding.item_id}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* 409 Conflict Alert */}
        {conflictError && (
          <Alert variant="warning" title="Version Conflict (409 Conflict)">
            {conflictError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Adjudication Action <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {actionOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = action === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setAction(opt.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? opt.activeColor
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{opt.label}</span>
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="adjudication-reason" className="block text-xs font-semibold text-slate-700 mb-1">
              Decision Justification / Reason <span className="text-red-600">*</span>
            </label>
            <textarea
              id="adjudication-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label htmlFor="modal-reviewer-id" className="block font-semibold text-slate-700 mb-1">
                Reviewer ID
              </label>
              <input
                id="modal-reviewer-id"
                type="text"
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label htmlFor="expected-version" className="block font-semibold text-slate-700 mb-1">
                Target Version Lock
              </label>
              <input
                id="expected-version"
                type="number"
                value={finding.version}
                readOnly
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="primary"
              size="sm"
              icon={<Check className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              {isSubmitting ? 'Recording...' : 'Record Decision'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
