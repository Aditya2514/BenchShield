/** Offset (ms) of `timeZone` from UTC at instant `ts`. */
function zoneOffsetMs(ts: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ts));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - ts;
}

/**
 * Converts "midnight at the start of `date` in `timeZone`" into a UTC ISO
 * timestamp. The backend compares evidence times against this instant;
 * `cutoff_timezone` is stored only as a label.
 */
export function zonedMidnightToIso(date: string, timeZone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - zoneOffsetMs(guess, timeZone);
  // Re-check once in case the guess and the result straddle a DST change.
  return new Date(guess - zoneOffsetMs(first, timeZone)).toISOString();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
