import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { ACCESS_REFERENCE, FACILITY_TYPES, accessUnitForLgu, isPriced, totalMapped } from "./reference";
import { accessReadiness } from "./readiness";
import { buildAccessMedicines, buildAccessUnits, buildRetiredAccessMetrics } from "@/lib/api/access";
import { GET as unitsGet } from "@/app/api/v1/access/units/route";
import { ACCESS_MODE } from "@/lib/map/modes/access";
import type { MapDataBundle, MapFilters } from "@/lib/map/types";

/**
 * ACCESS on real data: mapped facilities (OpenStreetMap via HOT/HDX), DOH
 * medicine prices and reported dengue cases. These tests pin what makes it
 * trustworthy: the readiness gate, totals that add up, unknowns that stay
 * unknown, and nothing attributed to the wrong place.
 */

describe("ACCESS readiness", () => {
  it("is ready on the built reference data", () => {
    expect(accessReadiness(ACCESS_REFERENCE)).toEqual({ ready: true, reasons: [] });
  });

  it("is not ready on sample data, with no facilities, or with an unpinned source", () => {
    const sample = { ...ACCESS_REFERENCE, meta: { ...ACCESS_REFERENCE.meta, isSample: true } };
    expect(accessReadiness(sample).ready).toBe(false);

    const empty = {
      ...ACCESS_REFERENCE,
      meta: { ...ACCESS_REFERENCE.meta, facilityCounts: { ...ACCESS_REFERENCE.meta.facilityCounts, kept: 0 } },
    };
    expect(accessReadiness(empty).reasons).toContain("No facility records are loaded.");

    const unpinned = {
      ...ACCESS_REFERENCE,
      meta: {
        ...ACCESS_REFERENCE.meta,
        sources: ACCESS_REFERENCE.meta.sources.map((s, i) => (i === 0 ? { ...s, sha256: undefined } : s)),
      },
    };
    expect(accessReadiness(unpinned).ready).toBe(false);
  });
});

describe("ACCESS reference data", () => {
  const { meta, units, medicines } = ACCESS_REFERENCE;

  it("covers the 126 reporting units, and unit totals add up to the facilities kept", () => {
    expect(units).toHaveLength(126);
    expect(new Set(units.map((u) => u.id)).size).toBe(126);
    expect(units.reduce((sum, u) => sum + totalMapped(u), 0)).toBe(meta.facilityCounts.kept);
    for (const u of units) for (const t of FACILITY_TYPES) expect(u.mappedFacilities[t]).toBeGreaterThanOrEqual(0);
  });

  it("never fills population, stock or searches", () => {
    for (const u of units) expect(u.population).toBeNull();
    for (const u of buildAccessUnits().units) {
      expect(u.medicineAvailability).toBeNull();
      expect(u.searchDemand).toBeNull();
    }
  });

  it("sums dengue cases over usable weeks only, never more weeks than the year has", () => {
    for (const u of units) {
      for (const y of u.dengue ?? []) {
        expect(y.usableWeeks).toBeLessThanOrEqual(y.weeks);
        if (y.usableWeeks === 0) expect(y.reportedCases).toBe(0);
      }
    }
  });

  it("keeps each price range ordered and never prices an item the DOH hides", () => {
    for (const m of medicines) {
      for (const item of m.items) {
        if (isPriced(item)) {
          expect(item.lowestPhp).toBeLessThanOrEqual(item.medianPhp);
          expect(item.medianPhp).toBeLessThanOrEqual(item.highestPhp);
          expect(item.reportingFacilities).toBeGreaterThan(0);
        } else {
          expect(item).not.toHaveProperty("medianPhp");
        }
      }
    }
    expect(buildAccessMedicines().medicines.every((m) => m.onPnfEml)).toBe(true);
  });

  it("states its sources with links, licences and pinned hashes", () => {
    for (const s of meta.sources) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.license).toBeTruthy();
      expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("ACCESS places", () => {
  it("maps an LGU to its own reporting unit, and never to someone else's", () => {
    expect(accessUnitForLgu("quezon-city")?.id).toBe("quezon-city");
    expect(accessUnitForLgu("pasig")?.id).toBe("pasig-city");
    // Antipolo is reported inside Rizal, so it has no figures of its own.
    expect(accessUnitForLgu("antipolo")).toBeUndefined();
  });

  it("rejects an unknown unit in the API and answers a known one", async () => {
    const request = (q: string) => new NextRequest(`http://localhost/api/v1/access/units${q}`);
    const bad = await unitsGet(request("?unitId=atlantis"));
    expect(bad.status).toBe(400);
    const ok = await unitsGet(request("?unitId=quezon-city"));
    const body = await ok.json();
    expect(body.meta.status).toBe("live");
    expect(body.data.units.map((u: { id: string }) => u.id)).toEqual(["quezon-city"]);
  });

  it("keeps the retired metrics endpoint empty and says where the real data is", () => {
    const retired = buildRetiredAccessMetrics();
    expect(retired.metrics).toEqual([]);
    expect(retired.scope.coverage).toEqual({ from: null, to: null });
    expect(retired.scope.sourceNote).toContain("/api/v1/access/units");
  });
});

describe("the ACCESS map", () => {
  const filters = { facilityType: "pharmacy" } as MapFilters;

  it("draws nothing and says why when the facility points failed to load", () => {
    const failed = ACCESS_MODE.prepare!({ accessPointsError: "HTTP 404" } as MapDataBundle, filters);
    expect(failed.legend.metric).toContain("HTTP 404");
    expect(failed.frameAt(0, { links: false, columns: false, areas: true }).features).toEqual([]);
  });

  it("draws only the selected facility type and shades units by mapped density", () => {
    const bundle = {
      accessPoints: {
        meta: {
          license: "ODbL 1.0",
          attribution: "© OpenStreetMap contributors, ODbL",
          source: "",
          snapshot: "2026-10-13",
          types: ["hospital", "clinic", "pharmacy", "laboratory"],
          units: ["quezon-city"],
        },
        points: [
          [121.05, 14.65, 2, 0, "A pharmacy"],
          [121.06, 14.66, 0, 0, "A hospital"],
        ],
      },
    } as MapDataBundle;
    const frame = ACCESS_MODE.prepare!(bundle, filters).frameAt(0, { links: false, columns: false, areas: true });
    expect(frame.features.map((f) => f.name)).toEqual(["A pharmacy"]);
    expect(frame.features[0].rows.find((r) => r.label === "Medicine stock")?.value).toMatch(/Unknown/);
    expect(frame.areas?.fills["quezon-city"]).toBeDefined();
  });
});
