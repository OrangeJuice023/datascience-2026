import "server-only";

import { dataProvider } from "@/data/opendengue-provider";
import { DEFAULT_SCENARIO } from "@/data/demo-simulations";
import { loadAccessBundle } from "@/lib/access/load";
import type { MapDataBundle } from "./types";

/**
 * Data acquisition for the analytical map, run on the server. Returns only
 * the small, already-shaped arrays the map needs.
 */
export async function loadMapBundle(): Promise<MapDataBundle> {
  const [signals, lgus, weekly, access] = await Promise.all([
    dataProvider.getSignals(),
    dataProvider.getLgus(),
    dataProvider.getHealthObservations("dengue", "ph", { temporalResolution: "weekly" }),
    loadAccessBundle(),
  ]);

  const perLgu = await Promise.all(
    lgus.map(async (lgu) => ({
      id: lgu.id,
      trend: (await dataProvider.getTrendSeries(lgu.id)) ?? [],
      neighbors: await dataProvider.getNeighborSummaries(lgu.id),
    })),
  );

  return {
    signals,
    lgus,
    trends: Object.fromEntries(perLgu.map((entry) => [entry.id, entry.trend])),
    neighbors: Object.fromEntries(perLgu.map((entry) => [entry.id, entry.neighbors])),
    nationalWeekly: weekly.map(({ periodStart, periodEnd, value }) => ({ periodStart, periodEnd, value })),
    scenario: DEFAULT_SCENARIO,
    access,
  };
}

/** Lighter bundle for the ACCESS page: LGU positions and access data only. */
export async function loadAccessMapBundle(): Promise<MapDataBundle> {
  const [lgus, access] = await Promise.all([dataProvider.getLgus(), loadAccessBundle()]);
  return {
    signals: [],
    lgus,
    trends: {},
    neighbors: {},
    nationalWeekly: [],
    scenario: DEFAULT_SCENARIO,
    access,
  };
}
