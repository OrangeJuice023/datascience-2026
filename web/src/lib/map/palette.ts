import type { SignalStatus } from "@/types";
import type { Rgba } from "./types";

/**
 * Map encodings. Status hues match lib/status (the app's badge tokens) so a
 * map point and its badge always agree.
 */
export const STATUS_HEX: Record<SignalStatus, string> = {
  normal: "#94a3b8",
  watch: "#f59e0b",
  elevated: "#e11d48",
};

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

/**
 * SIGMA: EARS and DOH-threshold states. "No data" (missing or suspect week)
 * is a pale neutral that is never the lowest class; "not computed" / "no
 * baseline" are a separate neutral, because the week has data but no result.
 */
export const SIGMA_HEX = {
  alarm: "#d03b3b",
  epidemic: "#d03b3b",
  alert: "#eda100",
  quiet: "#86b6ef",
  notEvaluated: "#a8a29e",
  noData: "#e2e8f0",
  cases: OBSERVED_HEX,
} as const;

/**
 * ENVIRONMENT: one-hue sequential ramp for weekly weather values, low → high
 * (light end clears the basemap). Incomplete weeks use the SIGMA no-data
 * neutral, which is paler than the lightest step so it never reads as "low".
 */
export const ENVIRONMENT_RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#0d366b"] as const;
export const ENVIRONMENT_NO_DATA_HEX = SIGMA_HEX.noData;

/** ENVIRONMENT chart: one hue per weather source (validated pair), provisional weeks in neutral. */
export const WEATHER_SOURCE_HEX = {
  cchain: "#2a78d6",
  open_meteo: "#eb6834",
  provisional: "#a8a29e",
} as const;
