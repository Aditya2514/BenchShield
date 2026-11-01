/**
 * Strict status vocabulary from docs/blueprint.md
 */

export type TemporalStatus =
  | 'verified_pre_cutoff'
  | 'observed_post_cutoff'
  | 'verified_introduced_post_cutoff'
  | 'unknown';

export type ClaimStatus =
  | 'candidate'
  | 'verified'
  | 'rejected'
  | 'needs_review';

export type TaskIdentity =
  | 'exact'
  | 'equivalent'
  | 'ambiguous'
  | 'different';

export type AnswerMatch =
  | 'exact'
  | 'normalized'
  | 'task_specific'
  | 'mismatch'
  | 'not_applicable';

export type Attribution =
  | 'none'
  | 'retrieval_observed'
  | 'use_supported'
  | 'intervention_supported';

export type PolicyCompliance =
  | 'permitted'
  | 'violated'
  | 'unknown';

export type ExposureDimension =
  | 'metadata'
  | 'question_context'
  | 'worked_solution'
  | 'reference_answer';

export type InvestigationState =
  | 'queued'
  | 'validating'
  | 'discovering'
  | 'verifying'
  | 'awaiting_review'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'policy_blocked'
  | 'budget_exhausted';

export interface StatusMeta {
  label: string;
  badgeClass: string;
  iconName: string;
}

export function getTemporalStatusMeta(status: TemporalStatus): StatusMeta {
  switch (status) {
    case 'verified_pre_cutoff':
      return {
        label: 'Verified Pre-Cutoff',
        badgeClass: 'bg-rose-950/80 text-rose-300 border border-rose-700/60',
        iconName: 'AlertTriangle',
      };
    case 'observed_post_cutoff':
      return {
        label: 'Observed Post-Cutoff',
        badgeClass: 'bg-amber-950/80 text-amber-300 border border-amber-700/60',
        iconName: 'Clock',
      };
    case 'verified_introduced_post_cutoff':
      return {
        label: 'Verified Post-Cutoff Intro',
        badgeClass: 'bg-blue-950/80 text-blue-300 border border-blue-700/60',
        iconName: 'CheckCircle2',
      };
    case 'unknown':
    default:
      return {
        label: 'Timing Unknown',
        badgeClass: 'bg-slate-800 text-slate-300 border border-slate-600',
        iconName: 'HelpCircle',
      };
  }
}

export function getClaimStatusMeta(status: ClaimStatus): StatusMeta {
  switch (status) {
    case 'verified':
      return {
        label: 'Verified Claim',
        badgeClass: 'bg-red-950/80 text-red-300 border border-red-700/60',
        iconName: 'AlertOctagon',
      };
    case 'candidate':
      return {
        label: 'Candidate Match',
        badgeClass: 'bg-yellow-950/80 text-yellow-300 border border-yellow-700/60',
        iconName: 'Search',
      };
    case 'rejected':
      return {
        label: 'Rejected Match',
        badgeClass: 'bg-slate-800 text-slate-400 border border-slate-700',
        iconName: 'XCircle',
      };
    case 'needs_review':
    default:
      return {
        label: 'Needs Review',
        badgeClass: 'bg-purple-950/80 text-purple-300 border border-purple-700/60',
        iconName: 'HelpCircle',
      };
  }
}

