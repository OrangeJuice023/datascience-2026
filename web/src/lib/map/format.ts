/**
 * Date formatting pinned to UTC so labels computed during prerender match the
 * client exactly (ISO dates are calendar dates, not instants).
 */
export function formatIsoDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}

export function daysBetweenIso(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) /
      86_400_000,
  );
}

export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
