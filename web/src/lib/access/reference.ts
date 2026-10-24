import REFERENCE from "@/data/access/access-reference.json";

/**
 * ACCESS reference data, built from real sources by
 * scripts/access/build-access.mjs: facilities and pharmacies mapped in
 * OpenStreetMap (HOT export on HDX, ODbL), DOH Drug Price Reference Index
 * prices for dengue medicines, and each reporting unit's reported dengue
 * cases. Medicine stock and search demand have no public source and are
 * never filled in.
 */
export type AccessFacilityType = "hospital" | "clinic" | "pharmacy" | "laboratory";

export const FACILITY_TYPES: AccessFacilityType[] = ["hospital", "clinic", "pharmacy", "laboratory"];

export const FACILITY_TYPE_LABEL: Record<AccessFacilityType, string> = {
  hospital: "Hospitals",
  clinic: "Clinics and primary care",
  pharmacy: "Pharmacies",
  laboratory: "Laboratories",
};

export interface AccessSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  license: string;
  attribution: string;
  snapshot?: string;
  edition?: string;
  sha256?: string;
}

export interface AccessDengueYear {
  year: number;
  /** Reported cases summed over usable weeks only; missing and suspect weeks are not counted as zero. */
  reportedCases: number;
  usableWeeks: number;
  weeks: number;
}

export interface AccessUnit {
  id: string;
  name: string;
  unitType: string;
  regionId: string;
  psgcCode: string | null;
  areaSqKm: number | null;
  /** Places mapped in OpenStreetMap; a low count can mean low mapping, not low access. */
  mappedFacilities: Record<AccessFacilityType, number>;
  mappedPer100SqKm: Record<AccessFacilityType, number> | null;
  /** Not in the repository yet; never estimated. */
  population: null;
  dengue: AccessDengueYear[] | null;
}

export type AccessPriceItem =
  | {
      item: string;
      status: "priced";
      lowestPhp: number;
      medianPhp: number;
      highestPhp: number;
      reportingFacilities: number;
    }
  | { item: string; status: string };

export interface AccessMedicine {
  id: string;
  name: string;
  role: string;
  onPnfEml: boolean;
  pnfPage: string | null;
  basis: string;
  items: AccessPriceItem[];
}

export interface AccessReference {
  meta: {
    generator: string;
    isSample: boolean;
    question: string;
    facilityTypes: AccessFacilityType[];
    sources: AccessSource[];
    facilityCounts: {
      features: number;
      kept: number;
      excludedType: number;
      duplicates: number;
      noLocation: number;
      unassigned: number;
      assignmentCrossCheck: { checked: number; agreed: number };
    };
    limitations: string[];
    unavailable: Record<string, string>;
  };
  units: AccessUnit[];
  medicines: AccessMedicine[];
}

export const ACCESS_REFERENCE = REFERENCE as unknown as AccessReference;

export const isPriced = (item: AccessPriceItem): item is Extract<AccessPriceItem, { status: "priced" }> =>
  item.status === "priced";

/** Facility points for the map, fetched on the client (ODbL, ~0.75 MB). */
export const ACCESS_POINTS_URL = "/data/access/facilities.json";

export interface AccessPoints {
  meta: { license: string; attribution: string; source: string; snapshot: string; types: AccessFacilityType[]; units: string[] };
  /** [lon, lat, type index, unit index, name] */
  points: [number, number, number, number, string | null][];
}

export function accessUnit(id: string): AccessUnit | undefined {
  return ACCESS_REFERENCE.units.find((u) => u.id === id);
}

/**
 * The reporting unit for one of the app's LGU ids (e.g. "pasig" → "pasig-city").
 * Returns undefined when the LGU is not reported on its own (Antipolo, for
 * example, is counted inside Rizal) so nothing is attributed to the wrong place.
 */
export function accessUnitForLgu(lguId: string): AccessUnit | undefined {
  return accessUnit(lguId) ?? accessUnit(`${lguId}-city`);
}

export function totalMapped(unit: AccessUnit): number {
  return FACILITY_TYPES.reduce((sum, t) => sum + unit.mappedFacilities[t], 0);
}
