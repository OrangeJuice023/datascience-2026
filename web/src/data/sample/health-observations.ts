import type { HealthObservation, IsoDate } from "@/types/data";
import { addDaysIso } from "@/lib/utils";
import { sampleProvenance } from "./provenance";

/**
 * DEMO / SAMPLE formal observations — NOT real Philippine statistics.
 *
 * Shaped like a national weekly surveillance extract (the resolution the
 * primary formal source is expected to provide). The values are small
 * placeholders chosen to be obviously unlike real national counts. There are
 * intentionally no sub-national observations: SIGMA does not fabricate
 * municipality-level case data. The last week ends a few days before the
 * newest sample signals, mimicking formal reporting lag.
 */
const WEEKLY_VALUES: Array<[periodStart: IsoDate, value: number]> = [
  ["2026-08-03", 100],
  ["2026-08-10", 104],
  ["2026-08-17", 98],
  ["2026-08-24", 112],
  ["2026-08-31", 131],
  ["2026-09-07", 158],
];

export const SAMPLE_HEALTH_OBSERVATIONS: HealthObservation[] = WEEKLY_VALUES.map(
  ([periodStart, value], index): HealthObservation => ({
    id: `obs-sample-ph-dengue-${periodStart}`,
    diseaseId: "dengue",
    geographyId: "ph",
    geographicLevel: "national",
    periodStart,
    periodEnd: addDaysIso(periodStart, 6),
    temporalResolution: "weekly",
    metric: "cases",
    caseDefinition: "total",
    value,
    provenance: sampleProvenance(["sample-formal-feed"], "ingested", {
      pipeline: "sample-fixture",
      upstreamId: `sample-row-${index + 1}`,
    }),
  }),
);
