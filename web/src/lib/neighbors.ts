import { getNeighborLgus } from "@/data/demo-lgus";
import { DEMO_SIGNALS } from "@/data/demo-signals";
import type { NeighborSummary, Signal } from "@/types";

/**
 * Nearby-LGU context for one disease.
 *
 * Only signals for the queried disease count: a dengue signal next door says
 * nothing about a measles question. Only signals dated within the reporting
 * window ending at `asOf` count, so an old signal is not shown as current.
 * A neighbour with no qualifying signal gets `status: null` and
 * `changePercent: null` ("no data"), never "normal, 0%".
 */

/** How far back a neighbour's signal may be and still describe the same period. */
export const NEIGHBOR_WINDOW_DAYS = 28;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface NeighborOptions {
  count?: number;
  /** End of the reporting window (YYYY-MM-DD). Defaults to the latest signal date for the disease. */
  asOf?: string;
  windowDays?: number;
  signals?: Signal[];
}

/** The key the map bundle stores neighbour lists under. */
export function neighborKey(disease: string, locationId: string): string {
  return `${disease}::${locationId}`;
}

function latestDate(signals: Signal[]): string | undefined {
  return signals.reduce<string | undefined>((max, s) => (max === undefined || s.date > max ? s.date : max), undefined);
}

export function getNeighborSummaries(
  locationId: string,
  disease: string,
  options: NeighborOptions = {},
): NeighborSummary[] {
  const { count = 3, windowDays = NEIGHBOR_WINDOW_DAYS, signals = DEMO_SIGNALS } = options;
  const forDisease = signals.filter((s) => s.disease === disease);
  const asOf = options.asOf ?? latestDate(forDisease);
  const end = asOf ? Date.parse(asOf) : NaN;
  const start = end - windowDays * DAY_MS;

  return getNeighborLgus(locationId, count).map((lgu) => {
    const latest = forDisease
      .filter((s) => s.locationId === lgu.id)
      .filter((s) => {
        const t = Date.parse(s.date);
        return Number.isFinite(t) && t <= end && t > start;
      })
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      locationId: lgu.id,
      locationName: lgu.name,
      disease,
      status: latest?.status ?? null,
      changePercent: latest?.changePercent ?? null,
      date: latest?.date ?? null,
    };
  });
}
