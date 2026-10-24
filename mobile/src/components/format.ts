/**
 * Display formatting. Plain TypeScript, so the rules are tested without
 * React Native, and deterministic: no locale lookup that differs between
 * Hermes, the web build and the test runner.
 */

/**
 * A share as a percentage, or a plain statement when there is nothing to
 * divide by. "0 of 0" is not 0%: it means there was nothing to measure.
 */
export function shareLabel(numerator: number, denominator: number, emptyLabel: string): string {
  if (!Number.isFinite(denominator) || denominator <= 0) return emptyLabel;
  return `${Math.round((numerator / denominator) * 100)}%`;
}

/** 12345 → "12,345". */
export function formatCount(value: number): string {
  const [whole, fraction] = String(value).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** A peso amount to the centavo: 0.5 → "₱0.50". */
export function formatPeso(value: number): string {
  const [whole, fraction] = value.toFixed(2).split('.');
  return `₱${formatCount(Number(whole))}.${fraction}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2016-01-10" → "10 Jan 2016". Anything that is not an ISO date is returned unchanged. */
export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month} ${match[1]}` : iso;
}

/** "1 week" / "3 weeks". */
export function weeksLabel(count: number): string {
  return `${formatCount(count)} week${count === 1 ? '' : 's'}`;
}

/**
 * The pill label for a data status. Every series SIGMA serves is real but
 * historical, so "live" (the API's word for "from a connected source") is
 * shown as historical data rather than as something current.
 */
export function historicalStatusLabel(status: string | null | undefined): string | undefined {
  return status === 'live' ? 'Historical data' : undefined;
}
