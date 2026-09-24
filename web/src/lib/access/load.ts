import "server-only";

import { accessProvider, type AccessDataProvider } from "@/data/access-provider";
import { packAccessBundle, type AccessBundle } from "./bundle";
import { computeAccessMetrics, facilityStates } from "./metrics";

/** Acquisition + aggregation on the server; returns only the compact bundle. */
export async function loadAccessBundle(provider: AccessDataProvider = accessProvider): Promise<AccessBundle> {
  const [medicines, facilities, snapshots, events, weeks, thresholds] = await Promise.all([
    provider.getMedicines(),
    provider.getFacilities(),
    provider.getInventorySnapshots(),
    provider.getSearchEvents(),
    provider.getReportingWeeks(),
    provider.getFreshnessThresholds(),
  ]);
  const medicineIds = medicines.map((m) => m.id);
  const states = facilityStates(facilities, medicineIds, snapshots, weeks, thresholds);
  const psgcByArea = Object.fromEntries(facilities.map((f) => [f.areaId, f.psgcCode]));
  const metrics = computeAccessMetrics({ facilities, medicineIds, states, events, weeks, psgcByArea });

  return packAccessBundle({
    isSample: provider.isSample,
    medicines,
    facilities,
    weeks,
    states,
    metrics,
    freshnessThresholds: thresholds,
  });
}
