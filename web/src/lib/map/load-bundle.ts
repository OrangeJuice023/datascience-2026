import "server-only";

import { dataProvider } from "@/data/opendengue-provider";
import { DEFAULT_SCENARIO } from "@/data/demo-simulations";
import type { MapDataBundle } from "./types";

/**
 * Data acquisition for the analytical map, run on the server. Returns only
 * the small, already-shaped arrays the map needs.
 */
export async function loadMapBundle(): Promise<MapDataBundle> {
  const [signals, lgus, weekly] = await Promise.all([
    dataProvider.getSignals(),
    dataProvider.getLgus(),
    dataProvider.getHealthObservations("dengue", "ph", { temporalResolution: "weekly" }),
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
  };
}
