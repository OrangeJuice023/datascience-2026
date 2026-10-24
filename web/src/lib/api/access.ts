import type {
  AccessMedicinesData,
  AccessMetricsData,
  AccessSourceRecord,
  AccessUnitsData,
} from "@sigma/contracts";
import { ACCESS_REFERENCE, isPriced, totalMapped, type AccessSource } from "@/lib/access/reference";

/**
 * ACCESS service layer, over the real reference data built by
 * scripts/access/build-access.mjs. Every response says what the data can and
 * cannot support: facilities are what is mapped in OpenStreetMap, prices are
 * DOH hospital procurement prices, and medicine stock and search demand are
 * never reported because no public source exists for them.
 */

export const ACCESS_SCOPE_SUPPORTS = [
  "How many hospitals, clinics, pharmacies and laboratories are mapped in OpenStreetMap in each reporting unit, and how dense they are per 100 km².",
  "Each reporting unit's reported dengue cases per year (2016-2020), summed over usable weeks only.",
  "What DOH hospitals paid for dengue medicines in 2025 procurement, and whether each medicine is on the PNF essential list.",
];

export const ACCESS_SCOPE_DOES_NOT_SUPPORT = [
  "Whether a medicine is in stock at any pharmacy or health centre (no public source reports it).",
  "What people search for (SIGMA collects no search data).",
  "Per-person rates: population by reporting unit is not in the dataset.",
  "A shortage declaration, procurement instruction or clinical recommendation.",
];

export function toSourceRecord(s: AccessSource): AccessSourceRecord {
  return {
    id: s.id,
    title: s.title,
    publisher: s.publisher,
    url: s.url,
    license: s.license,
    attribution: s.attribution,
    snapshot: s.snapshot ?? null,
    edition: s.edition ?? null,
    sha256: s.sha256 ?? null,
  };
}

export function buildAccessUnits(input: { unitId?: string } = {}): AccessUnitsData {
  const { meta, units } = ACCESS_REFERENCE;
  const selected = input.unitId ? units.filter((u) => u.id === input.unitId) : units;
  return {
    scope: {
      question: meta.question,
      units: selected.length,
      facilitiesMapped: selected.reduce((sum, u) => sum + totalMapped(u), 0),
      supports: ACCESS_SCOPE_SUPPORTS,
      doesNotSupport: ACCESS_SCOPE_DOES_NOT_SUPPORT,
      limitations: meta.limitations,
    },
    sources: meta.sources.map(toSourceRecord),
    units: selected.map((u) => ({
      id: u.id,
      name: u.name,
      unitType: u.unitType,
      regionId: u.regionId,
      psgcCode: u.psgcCode,
      areaSqKm: u.areaSqKm,
      mappedFacilities: u.mappedFacilities,
      mappedPer100SqKm: u.mappedPer100SqKm,
      population: null,
      medicineAvailability: null,
      searchDemand: null,
      dengue: u.dengue,
    })),
  };
}

export function buildAccessMedicines(): AccessMedicinesData {
  const { meta, medicines } = ACCESS_REFERENCE;
  return {
    scope: {
      priceBasis:
        "Unit prices DOH hospitals paid in 2025 procurement (2026 interim Drug Price Reference Index): lowest, median and highest across reporting hospitals. Not private pharmacy shelf prices.",
      doesNotSupport: ACCESS_SCOPE_DOES_NOT_SUPPORT.slice(0, 1).concat([
        "Prices for dengue rapid tests (no public source).",
      ]),
    },
    sources: meta.sources.filter((s) => s.id === "doh-dpri-dashboard").map(toSourceRecord),
    medicines: medicines.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      onPnfEml: m.onPnfEml,
      pnfPage: m.pnfPage,
      basis: m.basis,
      prices: m.items.map((item) =>
        isPriced(item)
          ? {
              item: item.item,
              status: item.status,
              lowestPhp: item.lowestPhp,
              medianPhp: item.medianPhp,
              highestPhp: item.highestPhp,
              reportingFacilities: item.reportingFacilities,
            }
          : { item: item.item, status: item.status, lowestPhp: null, medianPhp: null, highestPhp: null, reportingFacilities: null },
      ),
    })),
  };
}

/**
 * GET /access/metrics served weekly demo inventory and searches. Those
 * inputs have no real source, so the endpoint now returns empty lists and
 * says where the real ACCESS data is.
 */
export function buildRetiredAccessMetrics(): AccessMetricsData {
  return {
    scope: {
      isSample: false,
      source: "Retired: no public source for weekly medicine stock or searches",
      sourceNote:
        "This endpoint served demo inventory. Real ACCESS data (mapped facilities, DOH medicine prices) is at /api/v1/access/units and /api/v1/access/medicines.",
      areas: 0,
      facilities: 0,
      medicines: 0,
      weeks: 0,
      coverage: { from: null, to: null },
      supports: [],
      doesNotSupport: ACCESS_SCOPE_DOES_NOT_SUPPORT,
    },
    medicines: [],
    areas: [],
    weeks: [],
    metrics: [],
    areasForAssessment: [],
  };
}
