import type { InvestigationStatusResponse } from '@benchshield/api-client';
import { Alert } from '../../components/ui';

/**
 * Shown whenever coverage was incomplete. A partial audit must never read as
 * "no exposure detected".
 */
export function CoverageWarning({ investigation }: { investigation: InvestigationStatusResponse }) {
  const { limitations } = investigation;
  const items = [
    ...(limitations.provider_outages ?? []),
    ...(limitations.inaccessible_sources ?? []),
    ...(limitations.scope_limitations ?? []),
  ];
  if (!investigation.is_partial && items.length === 0) return null;

  return (
    <Alert variant="warning" title="Partial Coverage Audit Warning">
      <p className="mt-0.5">
        Only {investigation.investigated_items} of {investigation.total_items} items were fully investigated. Incomplete
        coverage must never be interpreted as an unexposed or clean result.
      </p>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-900 list-disc list-inside font-medium">
          {items.map((lim, idx) => (
            <li key={idx}>{lim}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
