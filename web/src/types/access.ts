/**
 * ACCESS data contracts: medicine availability, search demand and derived
 * access indicators. Aggregate and non-identifying by design.
 *
 * Honesty rules encoded in these shapes:
 * - A failed search is a demand/access signal, never a "shortage".
 * - Stale inventory is uncertainty, never "unavailable".
 * - Thin facility coverage lowers confidence; it never implies absence.
 * Exact quantities are not modeled: only coarse buckets.
 */
import type { IsoDate, IsoDateTime } from "./data";

export interface Medicine {
  /** Stable slug, e.g. "oral-rehydration-salts". */
  id: string;
  name: string;
  /** Grouping for the selector only; not a clinical recommendation. */
  category: string;
  isSample: boolean;
}

export type FacilityType =
  | "pharmacy"
  | "public_hospital"
  | "private_hospital"
  | "rhu"
  | "health_center"
  | "other";

export interface Facility {
  id: string;
  /** Demo records are named as prototypes; no real facility is represented. */
  name: string;
  type: FacilityType;
  /** PSA PSGC code of the containing area; null until reconciled. */
  psgcCode: string | null;
  /** SIGMA geography id of the containing area (e.g. an LGU). */
  areaId: string;
  latitude: number;
  longitude: number;
  source: string;
  updatedAt: IsoDateTime;
  isSample: boolean;
}

export type Availability = "available" | "low" | "unavailable" | "unknown";

/** Coarse buckets only; exact counts would imply false precision. */
export type QuantityBucket = "0" | "1-10" | "11-50" | "50+";

export type FreshnessStatus = "fresh" | "aging" | "stale" | "unknown";

/** One report from a facility about one medicine. */
export interface InventorySnapshot {
  id: string;
  facilityId: string;
  medicineId: string;
  availability: Availability;
  quantityBucket: QuantityBucket | null;
  /** When the facility reported this state. */
  updatedAt: IsoDateTime;
  source: string;
  isSample: boolean;
}

export type SearchResultType = "available_found" | "not_found_nearby" | "unknown";

/**
 * One consumer search, reduced to what aggregate demand analysis needs.
 * Deliberately no user id, name, phone, address, device id or health data;
 * location is the containing area, never a precise point.
 */
export interface MedicineSearchEvent {
  id: string;
  medicineId: string;
  areaId: string;
  psgcCode: string | null;
  timestamp: IsoDateTime;
  resultType: SearchResultType;
  isSample: boolean;
}

/** Illustrative analytical classes; not clinically validated thresholds. */
export type AccessGapLevel = "low" | "moderate" | "elevated" | "insufficient_data";

export type AccessConfidence = "low" | "medium" | "high";

/** Derived indicator for one medicine × area × period. */
export interface AccessMetric {
  medicineId: string;
  areaId: string;
  psgcCode: string | null;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  /** Search events in the period. */
  searchDemand: number;
  /** Searches that reported nothing found nearby. */
  notFoundSearches: number;
  /** Demand relative to this area's own early-period level for the medicine. */
  demandRatio: number;
  facilities: number;
  /** Facilities with a current (fresh/aging) report of available or low. */
  confirmedAvailable: number;
  /** Facilities with a current report of unavailable. */
  reportedUnavailable: number;
  /** Facilities whose latest report is stale: uncertainty, not unavailability. */
  staleInventory: number;
  /** Facilities with no report, or a report of unknown availability. */
  unknownInventory: number;
  /** Share of facilities with a current report, 0–1. */
  facilityCoverage: number;
  accessGap: AccessGapLevel;
  confidence: AccessConfidence;
  /** Plain-language reasons derived from the rules above. */
  reasons: string[];
  isSample: boolean;
}
