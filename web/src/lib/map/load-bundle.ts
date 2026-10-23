import "server-only";

import { dataProvider } from "@/data/opendengue-provider";
import { loadAccessBundle } from "@/lib/access/load";
import { neighborKey } from "@/lib/neighbors";
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
    })),
  );
  const diseases = [...new Set(signals.map((s) => s.disease))];
  const neighborEntries = await Promise.all(
    lgus.flatMap((lgu) =>
      diseases.map(
        async (disease) =>
          [neighborKey(disease, lgu.id), await dataProvider.getNeighborSummaries(lgu.id, disease)] as const,
      ),
    ),
  );

  return {
    signals,
    lgus,
    trends: Object.fromEntries(perLgu.map((entry) => [entry.id, entry.trend])),
    neighbors: Object.fromEntries(neighborEntries),
    nationalWeekly: weekly.map(({ periodStart, periodEnd, value }) => ({ periodStart, periodEnd, value })),
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
    access,
  };
}
