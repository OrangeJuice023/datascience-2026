import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { earsClass, dohClass, hasData, weekOf, weeksWithData, type SigmaData } from "@/lib/sigma/data";
import type { MapDataBundle, MapFilters, MapLayerToggles } from "../types";
import { SIGMA_MODE, SIGMA_STATE_NOTE } from "./sigma";

/**
 * The SIGMA layer carries the project's data rules onto the map: missing and
 * suspect-swap weeks are no data (never zero, never the lowest class), a week
 * with no data anywhere is a gap, and area fills never encode counts. These
 * tests run against the committed export, so they also check the export.
 */

const read = (rel: string) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));
const data: SigmaData = read("../../../../public/data/sigma/hdx-dengue-sigma.json");
const boundaries = read("../../../../public/geo/hdx-reporting-units.geojson") as {
  features: Array<{ id: string; geometry: { type: string } }>;
};

const bundle = { sigma: data } as MapDataBundle;
const filters = (sigmaLayer: MapFilters["sigmaLayer"]) => ({ sigmaLayer }) as MapFilters;
const toggles: MapLayerToggles = { links: false, columns: false, areas: true };

describe("SIGMA export", () => {
  it("covers the 126 reporting units on one weekly calendar, with matching boundaries", () => {
    expect(data.units).toHaveLength(126);
    expect(data.meta.isSample).toBe(false);
    for (const unit of data.units) expect(unit.value).toHaveLength(data.meta.weeks.length);
    const ids = new Set(data.units.map((u) => u.id));
    expect(new Set(boundaries.features.map((f) => f.id))).toEqual(ids);
  });

  it("never carries a value for a week that is not ok", () => {
    let suspect = 0;
    for (const unit of data.units) {
      data.meta.weeks.forEach((_, i) => {
        const w = weekOf(data, unit, i);
        if (w.quality !== "ok") expect(w.value).toBeNull();
        if (w.quality === "suspect swap") suspect++;
      });
    }
    expect(suspect).toBe(665);
  });

  it("treats a week with no data for any unit as a gap", () => {
    const missing = data.meta.weeks.indexOf("2019-01-06");
    expect(missing).toBeGreaterThan(0);
    expect(weeksWithData(data)).not.toContain(missing);
  });
});

describe("SIGMA mode", () => {
  const prepared = SIGMA_MODE.prepare!(bundle, filters("ears"));

  it("draws no-data weeks as no data, never as the lowest class", () => {
    const unit = data.units.find((u) => u.quality.some((q) => data.meta.codes.quality[q] === "suspect swap"))!;
    const wi = unit.quality.findIndex((q) => data.meta.codes.quality[q] === "suspect swap");
    const w = weekOf(data, unit, wi);
    expect(hasData(w)).toBe(false);
    expect(earsClass(w)).toBe("no_data");
    expect(dohClass(w)).toBe("no_data");

    const sliceIndex = prepared.timeline.slices.findIndex((s) => s.key === data.meta.weeks[wi]);
    const feature = prepared.frameAt(sliceIndex, toggles).features.find((f) => f.id === unit.id)!;
    expect(feature.classLabel).toMatch(/No data/);
    expect(feature.rows[1]).toEqual({ label: "Reported cases", value: "No data" });
  });

  it("marks the timeline break after the missing week", () => {
    const i = prepared.timeline.slices.findIndex((s) => s.key === "2019-01-13");
    expect(prepared.timeline.slices[i].gapBefore).toBe(true);
  });

  it("states that colours are relative to each area's own history", () => {
    expect(prepared.legend.note).toContain(SIGMA_STATE_NOTE);
    expect(SIGMA_MODE.prepare!(bundle, filters("doh")).legend.note).toContain(SIGMA_STATE_NOTE);
  });

  it("never fills areas by count", () => {
    const cases = SIGMA_MODE.prepare!(bundle, filters("cases"));
    expect(cases.frameAt(0, toggles).areas).toBeUndefined();
    expect(prepared.frameAt(0, toggles).areas?.fills).toBeDefined();
  });

  it("shows a load error instead of an empty map", () => {
    const failed = SIGMA_MODE.prepare!({ sigmaError: "HTTP 404" } as MapDataBundle, filters("ears"));
    expect(failed.legend.metric).toContain("HTTP 404");
    expect(failed.timeline.slices).toHaveLength(0);
  });
});
