import type { Availability, InventorySnapshot, QuantityBucket } from "@/types/access";
import { seededNoise } from "@/lib/utils";
import { ACCESS_WEEKS, DEMO_ACCESS_SOURCE, DEMO_PRESSURE, DEMO_REPORTING_DROPOUT } from "./demo-access";
import { DEMO_FACILITIES } from "./demo-facilities";
import { DEMO_MEDICINES } from "./demo-medicines";

/**
 * DEMO inventory reports, generated deterministically from the scenario in
 * demo-access.ts. Not real inventory: availability and report timing are
 * constructed to exercise available / low / unavailable / unknown and
 * fresh / aging / stale states.
 */

/** Facility slot 3 in Marikina never reports this medicine (unknown availability). */
const NEVER_REPORTS = new Set(["fac-marikina-3|antihistamine"]);

function availabilityFor(areaId: string, medicineId: string, week: number, seed: number): Availability {
  const pressure = DEMO_PRESSURE[medicineId];
  if (pressure && pressure.areas.includes(areaId) && week >= pressure.fromWeek) {
    const score = (week - pressure.fromWeek) * 0.9 + seededNoise(seed, 11) * 0.8;
    if (score < 0.8) return "available";
    if (score < 1.8) return "low";
    return "unavailable";
  }
  return seededNoise(seed, 13) > 0.92 ? "low" : "available";
}

function bucketFor(availability: Availability, seed: number): QuantityBucket | null {
  switch (availability) {
    case "available":
      return seededNoise(seed, 17) > 0.5 ? "50+" : "11-50";
    case "low":
      return "1-10";
    case "unavailable":
      return "0";
    default:
      return null;
  }
}

function isoMinusHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) - hours * 3_600_000).toISOString().replace(".000Z", "Z");
}

export const DEMO_INVENTORY: InventorySnapshot[] = DEMO_FACILITIES.flatMap((facility, fIndex) =>
  DEMO_MEDICINES.flatMap((medicine, mIndex) => {
    if (NEVER_REPORTS.has(`${facility.id}|${medicine.id}`)) return [];
    const slot = Number(facility.id.split("-").pop());
    const dropoutWeek = DEMO_REPORTING_DROPOUT[facility.areaId];
    return ACCESS_WEEKS.flatMap((week): InventorySnapshot[] => {
      if (dropoutWeek !== undefined && week.index >= dropoutWeek) return [];
      const seed = fIndex * 100 + mIndex * 10 + week.index;
      const availability = availabilityFor(facility.areaId, medicine.id, week.index, seed);
      // Slot-3 facilities report with a 1.5–3 day delay (aging); others within a day.
      const delayHours = slot === 3 ? 36 + seededNoise(seed, 19) * 30 : 2 + seededNoise(seed, 23) * 18;
      return [
        {
          id: `inv-${facility.id}-${medicine.id}-w${week.index + 1}`,
          facilityId: facility.id,
          medicineId: medicine.id,
          availability,
          quantityBucket: bucketFor(availability, seed),
          updatedAt: isoMinusHours(week.asOf, delayHours),
          source: DEMO_ACCESS_SOURCE,
          isSample: true,
        },
      ];
    });
  }),
);
