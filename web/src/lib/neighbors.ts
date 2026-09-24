import { getNeighborLgus } from "@/data/demo-lgus";
import { DEMO_SIGNALS } from "@/data/demo-signals";
import { SEVERITY_ORDER } from "@/lib/status";
import type { NeighborSummary } from "@/types";

export function getNeighborSummaries(locationId: string, count = 3): NeighborSummary[] {
  return getNeighborLgus(locationId, count).map((lgu) => {
    const top = DEMO_SIGNALS.filter((s) => s.locationId === lgu.id).sort(
      (a, b) => SEVERITY_ORDER[b.status] - SEVERITY_ORDER[a.status],
    )[0];
    return {
      locationId: lgu.id,
      locationName: lgu.name,
      status: top?.status ?? "normal",
      changePercent: top?.changePercent ?? 0,
    };
  });
}
