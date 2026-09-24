import type { AccessMetric, Facility, Medicine } from "@/types/access";
import type { FacilityState } from "./metrics";

/**
 * Compact, serializable ACCESS data sent to the browser. Individual search
 * events and raw snapshots stay on the server; per-week states and metrics
 * are nested (medicine → facility/area → week) so ids and dates are not
 * repeated on every row. Components use the lookup helpers below and never
 * depend on this layout.
 */
export interface AccessWeekRef {
  index: number;
  periodStart: string;
  periodEnd: string;
  asOf: string;
}

/** A facility's latest report as of one week end. */
export type FacilityWeekState = Pick<FacilityState, "availability" | "quantityBucket" | "freshness" | "ageHours">;

/** One week of an AccessMetric, with its medicine, area and period implied by position. */
export type AccessMetricPoint = Omit<AccessMetric, "medicineId" | "areaId" | "psgcCode" | "periodStart" | "periodEnd" | "isSample">;

export interface AccessBundle {
  isSample: boolean;
  medicines: Medicine[];
  facilities: Facility[];
  weeks: AccessWeekRef[];
  /** medicineId → facilityId → state per week index. */
  states: Record<string, Record<string, FacilityWeekState[]>>;
  /** medicineId → areaId → metric per week index. */
  metrics: Record<string, Record<string, AccessMetricPoint[]>>;
  freshnessThresholds: { fresh: number; aging: number };
}

/** Implied by nesting position (or constant for the bundle), so not repeated per row. */
const POSITIONAL_FIELDS = new Set(["medicineId", "areaId", "psgcCode", "periodStart", "periodEnd", "isSample"]);

export function packAccessBundle(input: {
  isSample: boolean;
  medicines: Medicine[];
  facilities: Facility[];
  weeks: AccessWeekRef[];
  states: FacilityState[];
  metrics: AccessMetric[];
  freshnessThresholds: { fresh: number; aging: number };
}): AccessBundle {
  const states: AccessBundle["states"] = {};
  for (const s of input.states) {
    const byFacility = (states[s.medicineId] ??= {});
    (byFacility[s.facilityId] ??= [])[s.weekIndex] = {
      availability: s.availability,
      quantityBucket: s.quantityBucket,
      freshness: s.freshness,
      ageHours: s.ageHours,
    };
  }
  const weekIndex = new Map(input.weeks.map((w) => [w.periodStart, w.index]));
  const metrics: AccessBundle["metrics"] = {};
  for (const m of input.metrics) {
    const point = Object.fromEntries(
      Object.entries(m).filter(([key]) => !POSITIONAL_FIELDS.has(key)),
    ) as AccessMetricPoint;
    const byArea = (metrics[m.medicineId] ??= {});
    (byArea[m.areaId] ??= [])[weekIndex.get(m.periodStart) ?? 0] = point;
  }
  return { ...input, states, metrics };
}

export type AccessMetricView = "availability" | "demand" | "freshness" | "gap";

export const ACCESS_METRIC_LABEL: Record<AccessMetricView, string> = {
  availability: "Facility availability",
  demand: "Search demand",
  freshness: "Inventory freshness",
  gap: "Potential access gap",
};

export const GAP_LABEL: Record<AccessMetric["accessGap"], string> = {
  low: "Low",
  moderate: "Moderate",
  elevated: "Elevated",
  insufficient_data: "Insufficient data",
};

export function metricFor(
  bundle: AccessBundle,
  areaId: string,
  medicineId: string,
  weekIndex: number,
): AccessMetricPoint | undefined {
  return bundle.metrics[medicineId]?.[areaId]?.[weekIndex];
}

export function stateFor(
  bundle: AccessBundle,
  facilityId: string,
  medicineId: string,
  weekIndex: number,
): FacilityWeekState | undefined {
  return bundle.states[medicineId]?.[facilityId]?.[weekIndex];
}

export function facilityById(bundle: AccessBundle, id: string): Facility | undefined {
  return bundle.facilities.find((f) => f.id === id);
}

export function areaIds(bundle: AccessBundle): string[] {
  return [...new Set(bundle.facilities.map((f) => f.areaId))];
}
