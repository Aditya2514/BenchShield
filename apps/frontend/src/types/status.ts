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
        badgeClass: 'bg-red-50 text-red-800 border-red-300',
        iconName: 'AlertTriangle',
      };
    case 'observed_post_cutoff':
      return {
        label: 'Observed Post-Cutoff',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
        iconName: 'Clock',
      };
    case 'verified_introduced_post_cutoff':
      return {
        label: 'Verified Post-Cutoff Intro',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-300',
        iconName: 'CheckCircle2',
      };
    case 'unknown':
    default:
      return {
        label: 'Timing Unknown',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        iconName: 'HelpCircle',
      };
  }
}

export function getClaimStatusMeta(status: ClaimStatus): StatusMeta {
  switch (status) {
    case 'verified':
      return {
        label: 'Verified Claim',
        badgeClass: 'bg-red-50 text-red-800 border-red-300',
        iconName: 'AlertOctagon',
      };
    case 'candidate':
      return {
        label: 'Candidate Match',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
        iconName: 'Search',
      };
    case 'rejected':
      return {
        label: 'Rejected Match',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
        iconName: 'XCircle',
      };
    case 'needs_review':
    default:
      return {
        label: 'Needs Review',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-300',
        iconName: 'HelpCircle',
      };
  }
}

