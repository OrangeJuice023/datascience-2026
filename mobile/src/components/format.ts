/**
 * A share as a percentage, or a plain statement when there is nothing to
 * divide by. "0 of 0" is not 0%: it means there was nothing to measure.
 */
export function shareLabel(numerator: number, denominator: number, emptyLabel: string): string {
  if (!Number.isFinite(denominator) || denominator <= 0) return emptyLabel;
  return `${Math.round((numerator / denominator) * 100)}%`;
}
