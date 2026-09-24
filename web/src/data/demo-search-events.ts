import "server-only";

import type { MedicineSearchEvent, SearchResultType } from "@/types/access";
import { DEMO_LGUS } from "./demo-lgus";
import { DEMO_MEDICINES } from "./demo-medicines";
import { ACCESS_WEEKS, DEMO_PRESSURE } from "./demo-access";
import { DEMO_INVENTORY } from "./demo-inventory";
import { seededNoise } from "@/lib/utils";

/**
 * DEMO consumer search events. Aggregate and non-identifying: each event is
 * a medicine, an area, a timestamp and a result type — nothing else. Used
 * only on the server, where it is aggregated into AccessMetric rows; the
 * individual events never reach the browser.
 */

const BASE_WEEKLY_SEARCHES: Record<string, number> = {
  "oral-rehydration-salts": 14,
  paracetamol: 22,
  antihistamine: 10,
  "zinc-supplement": 6,
};

function notFoundShare(areaId: string, medicineId: string, weekIndex: number): number {
  // This week's reports from the area's facilities.
  const reports = DEMO_INVENTORY.filter(
    (s) =>
      s.medicineId === medicineId &&
      s.facilityId.startsWith(`fac-${areaId}-`) &&
      s.id.endsWith(`-w${weekIndex + 1}`),
  );
  const unavailable = reports.filter((s) => s.availability === "unavailable").length;
  const low = reports.filter((s) => s.availability === "low").length;
  const n = reports.length || 1;
  return Math.min(0.85, 0.05 + (unavailable / n) * 0.7 + (low / n) * 0.25);
}

export const DEMO_SEARCH_EVENTS: MedicineSearchEvent[] = DEMO_LGUS.flatMap((lgu, aIndex) =>
  DEMO_MEDICINES.flatMap((medicine, mIndex) =>
    ACCESS_WEEKS.flatMap((week) => {
      const pressure = DEMO_PRESSURE[medicine.id];
      const pressured = pressure?.areas.includes(lgu.id) && week.index >= pressure.fromWeek;
      const growth = pressured ? 1 + (week.index - pressure.fromWeek + 1) * 0.55 : 1;
      const seed = aIndex * 100 + mIndex * 10 + week.index;
      const count = Math.round(BASE_WEEKLY_SEARCHES[medicine.id] * growth * (0.8 + seededNoise(seed, 29) * 0.4));
      const missShare = notFoundShare(lgu.id, medicine.id, week.index);
      return Array.from({ length: count }, (_, i): MedicineSearchEvent => {
        const r = seededNoise(seed * 97 + i, 31);
        const resultType: SearchResultType = r < missShare ? "not_found_nearby" : r > 0.97 ? "unknown" : "available_found";
        const hour = Math.floor(seededNoise(seed * 89 + i, 37) * 7 * 24);
        return {
          id: `search-${lgu.id}-${medicine.id}-w${week.index + 1}-${i + 1}`,
          medicineId: medicine.id,
          areaId: lgu.id,
          psgcCode: null,
          timestamp: new Date(Date.parse(`${week.periodStart}T00:00:00Z`) + hour * 3_600_000)
            .toISOString()
            .replace(".000Z", "Z"),
          resultType,
          isSample: true,
        };
      });
    }),
  ),
);
