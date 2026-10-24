import "server-only";

import { dataProvider } from "@/data/opendengue-provider";
import { neighborKey } from "@/lib/neighbors";
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
  };
}
