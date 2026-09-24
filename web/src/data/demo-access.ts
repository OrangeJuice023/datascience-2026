import { addDaysIso } from "@/lib/utils";

/**
 * DEMO ACCESS scenario configuration. Everything here is illustrative:
 * the weeks, the pressure pattern and the thresholds exist to exercise the
 * ACCESS interface and are not derived from any real inventory or search
 * data. No correlation with signals or formal observations is computed.
 */

export const DEMO_ACCESS_SOURCE = "Demo inventory (prototype)";
export const DEMO_SEARCH_SOURCE = "Demo search events (prototype)";

/** Six reporting weeks, Sunday–Saturday. */
export const ACCESS_WEEK_STARTS = [
  "2026-08-09",
  "2026-08-16",
  "2026-08-23",
  "2026-08-30",
  "2026-09-06",
  "2026-09-13",
];

export interface AccessWeek {
  index: number;
  periodStart: string;
  periodEnd: string;
  /** Point in time at which freshness is judged: end of the week. */
  asOf: string;
}

export const ACCESS_WEEKS: AccessWeek[] = ACCESS_WEEK_STARTS.map((start, index) => ({
  index,
  periodStart: start,
  periodEnd: addDaysIso(start, 6),
  asOf: `${addDaysIso(start, 6)}T23:59:00Z`,
}));

/**
 * Prototype freshness thresholds (hours since a facility's last report).
 * Not validated operational standards.
 */
export const FRESHNESS_THRESHOLDS_HOURS = { fresh: 24, aging: 72 } as const;

/**
 * Where the demo scenario builds pressure, per medicine: demand rises from
 * `fromWeek` and reported availability tightens. Illustrative only.
 */
export const DEMO_PRESSURE: Record<string, { areas: string[]; fromWeek: number }> = {
  "oral-rehydration-salts": { areas: ["antipolo", "pasig", "marikina"], fromWeek: 2 },
  paracetamol: { areas: ["quezon-city", "antipolo", "pasig"], fromWeek: 2 },
  antihistamine: { areas: [], fromWeek: 99 },
  "zinc-supplement": { areas: ["manila"], fromWeek: 3 },
};

/** Areas whose demo facilities stop reporting mid-scenario (exercises stale data). */
export const DEMO_REPORTING_DROPOUT: Record<string, number> = {
  caloocan: 2,
};
