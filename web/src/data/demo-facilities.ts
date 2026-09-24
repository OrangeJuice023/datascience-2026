import type { Facility, FacilityType } from "@/types/access";
import { DEMO_LGUS } from "./demo-lgus";
import { seededNoise } from "@/lib/utils";
import { DEMO_ACCESS_SOURCE } from "./demo-access";
import { facilityTypeLabel } from "@/lib/access/labels";

/**
 * DEMO participating facilities. Names are prototype labels ("Demo …"), not
 * real establishments; positions are small deterministic offsets around
 * each demo LGU centroid, not real addresses.
 */
const TYPES_BY_SLOT: FacilityType[] = ["pharmacy", "health_center", "pharmacy"];


export const DEMO_FACILITIES: Facility[] = DEMO_LGUS.flatMap((lgu, lguIndex) =>
  TYPES_BY_SLOT.map((type, slot): Facility => {
    const seed = lguIndex * 10 + slot;
    return {
      id: `fac-${lgu.id}-${slot + 1}`,
      name: `Demo ${facilityTypeLabel(type)} ${lgu.name} ${slot + 1}`,
      type,
      psgcCode: null,
      areaId: lgu.id,
      latitude: lgu.latitude + (seededNoise(seed, 3) - 0.5) * 0.03,
      longitude: lgu.longitude + (seededNoise(seed, 7) - 0.5) * 0.03,
      source: DEMO_ACCESS_SOURCE,
      updatedAt: "2026-08-01T00:00:00Z",
      isSample: true,
    };
  }),
);
