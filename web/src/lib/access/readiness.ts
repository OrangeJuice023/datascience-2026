import type { AccessReference } from "./reference";

/**
 * Whether ACCESS may be shown as a working, live-data feature.
 *
 * It is decided by the data, never by a label: ACCESS is ready only when its
 * reference data is built from real sources (not sample data), every source
 * is pinned with a link and a hash, and facilities were actually loaded.
 * Until then the Analyze tab shows an honest "not available yet" state.
 */
export interface AccessReadiness {
  ready: boolean;
  /** Plain-language reasons it is not ready; empty when ready. */
  reasons: string[];
}

export function accessReadiness(reference: Pick<AccessReference, "meta" | "units">): AccessReadiness {
  const reasons: string[] = [];
  if (reference.meta.isSample) {
    reasons.push("Its records are demonstration data, not real sources.");
  }
  if (reference.meta.facilityCounts.kept === 0 || reference.units.length === 0) {
    reasons.push("No facility records are loaded.");
  }
  const unpinned = reference.meta.sources.filter((s) => !s.url || !s.sha256);
  if (unpinned.length > 0) {
    reasons.push(`Sources without a link or pinned hash: ${unpinned.map((s) => s.id).join(", ")}.`);
  }
  return { ready: reasons.length === 0, reasons };
}
