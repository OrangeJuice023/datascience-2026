export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function formatMultiplier(value: number): string {
  return `${(Math.round(value * 10) / 10).toFixed(1)}x baseline`;
}

/** Deterministic pseudo-random in [0, 1), stable across server/client renders. */
export function seededNoise(index: number, seed = 1): number {
  const x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Shifts an ISO date (YYYY-MM-DD) by whole days, in UTC. */
export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
