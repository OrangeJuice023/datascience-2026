import "server-only";

import type { Facility, InventorySnapshot, Medicine, MedicineSearchEvent } from "@/types/access";
import { ACCESS_WEEKS, FRESHNESS_THRESHOLDS_HOURS, type AccessWeek } from "./demo-access";
import { DEMO_FACILITIES } from "./demo-facilities";
import { DEMO_INVENTORY } from "./demo-inventory";
import { DEMO_MEDICINES } from "./demo-medicines";
import { DEMO_SEARCH_EVENTS } from "./demo-search-events";

/**
 * ACCESS data boundary. The UI never learns where records come from:
 * DemoAccessProvider today, a SupabaseAccessProvider (see
 * docs/access-data-model.md) later. Server-only: raw search events and
 * snapshots are aggregated before anything reaches the browser.
 */
export interface AccessDataProvider {
  getMedicines(): Promise<Medicine[]>;
  getFacilities(): Promise<Facility[]>;
  getInventorySnapshots(medicineId?: string): Promise<InventorySnapshot[]>;
  getSearchEvents(medicineId?: string): Promise<MedicineSearchEvent[]>;
  getReportingWeeks(): Promise<AccessWeek[]>;
  getFreshnessThresholds(): Promise<{ fresh: number; aging: number }>;
  /** Whether records are demo/prototype data. */
  readonly isSample: boolean;
}

export class DemoAccessProvider implements AccessDataProvider {
  readonly isSample = true;

  async getMedicines() {
    return DEMO_MEDICINES;
  }

  async getFacilities() {
    return DEMO_FACILITIES;
  }

  async getInventorySnapshots(medicineId?: string) {
    return medicineId ? DEMO_INVENTORY.filter((s) => s.medicineId === medicineId) : DEMO_INVENTORY;
  }

  async getSearchEvents(medicineId?: string) {
    return medicineId ? DEMO_SEARCH_EVENTS.filter((e) => e.medicineId === medicineId) : DEMO_SEARCH_EVENTS;
  }

  async getReportingWeeks() {
    return ACCESS_WEEKS;
  }

  async getFreshnessThresholds() {
    return { ...FRESHNESS_THRESHOLDS_HOURS };
  }
}

export const accessProvider: AccessDataProvider = new DemoAccessProvider();
