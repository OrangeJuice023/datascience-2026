import type { SignalStatus } from "@/types";
import type { Rgba } from "./types";

/**
 * Map encodings. Status hues match lib/status (the app's badge tokens) so a
 * map point and its badge always agree. The anomaly ramp is diverging:
 * blue (below expected) ↔ gray midpoint ↔ red (above expected), two equal
 * steps per arm. Scenario outputs use violet so modeled reach is never
 * mistaken for an observation.
 */
export const STATUS_HEX: Record<SignalStatus, string> = {
  normal: "#94a3b8",
  watch: "#f59e0b",
  elevated: "#e11d48",
};

export const ANOMALY_HEX = {
  wellBelow: "#2a78d6",
  below: "#86b6ef",
  within: "#b8b6ae",
  above: "#f19a82",
  elevated: "#d03b3b",
} as const;

export const SCENARIO_HEX = {
  origin: "#4a3aa7",
  reached: "#8b80e0",
  link: "#6d5fd3",
} as const;

export const NEUTRAL_LINK_HEX = "#64748b";
export const OBSERVED_HEX = "#0d9488";

export function hexToRgba(hex: string, alpha = 255): Rgba {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
    alpha,
  ];
}

/** ACCESS: availability states (paired with labels; unknown is neutral). */
export const AVAILABILITY_HEX = {
  available: "#1baf7a",
  low: "#eda100",
  unavailable: "#e34948",
  unknown: "#b8b6ae",
} as const;

/** ACCESS: freshness, an ordinal blue ramp (fresh darkest) plus neutral unknown. */
export const FRESHNESS_HEX = {
  fresh: "#1c5cab",
  aging: "#5598e7",
  stale: "#b7d3f6",
  unknown: "#b8b6ae",
} as const;

/** ACCESS: sequential demand ramp, low → high (one hue). */
export const DEMAND_RAMP = ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"] as const;

/** ACCESS: illustrative access-gap classes; insufficient data is deliberately pale. */
export const GAP_HEX = {
  low: "#b8b6ae",
  moderate: "#f19a82",
  elevated: "#d03b3b",
  insufficient_data: "#e2e8f0",
} as const;
