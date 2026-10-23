import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { qcFlagsAt, weekIndex, type EnvironmentBundle } from "@/lib/environment/bundle";
import type { SigmaData } from "@/lib/sigma/data";
import type { WeatherSourceId, WeatherVariable } from "@/types/data";
import { ENVIRONMENT_NO_DATA_HEX, ENVIRONMENT_RAMP, hexToRgba } from "../palette";
import type { MapDataBundle, MapFilters, MapLayerToggles } from "../types";
import { ENVIRONMENT_MODE, ENVIRONMENT_NOTE, rampColor } from "./environment";

/**
 * The ENVIRONMENT layer carries the weather track's rules onto the map:
 * incomplete weeks are no data (never filled, never the lowest class), the
 * two sources are never spliced, provisional ERA5T weeks are marked, and every
 * city links to the right HDX reporting unit. These tests run against the
 * committed export, so they also check the export.
 */

const read = (rel: string) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));
const data: EnvironmentBundle = read("../../../data/environment-weekly.json");
const sigma: SigmaData = read("../../../../public/data/sigma/hdx-dengue-sigma.json");

const bundle = { environment: data } as MapDataBundle;
const filters = (envSource: WeatherSourceId, envVariable: WeatherVariable = "precipitation_mm") =>
  ({ envSource, envVariable }) as MapFilters;
const toggles: MapLayerToggles = { links: false, columns: false, areas: false };
const prepare = (f: MapFilters) => ENVIRONMENT_MODE.prepare!(bundle, f);

describe("environment export", () => {
  it("covers the 12 CCHAIN cities with one series per city and source", () => {
    expect(data.geographies).toHaveLength(12);
    expect(data.series).toHaveLength(24);
    for (const g of data.geographies) {
      expect(data.series.filter((s) => s.geographyId === g.id).map((s) => s.sourceId).sort()).toEqual([
        "cchain",
        "open_meteo",
      ]);
    }
  });

  it("links every city to an HDX reporting unit on the SIGMA map", () => {
    const units = new Set(sigma.units.map((u) => u.id));
    for (const g of data.geographies) {
      expect(units.has(g.hdxUnitId)).toBe(true);
      // A same_area city is its own reporting unit; an inside_unit city is part of a larger one.
      expect(g.hdxUnitId === g.id).toBe(g.hdxUnitRelation === "same_area");
    }
  });

  it("never carries a value for an incomplete week", () => {
    for (const s of data.series) {
      s.daysObserved.forEach((days, i) => {
        if (days < 7) {
          for (const v of Object.keys(data.variables) as WeatherVariable[]) expect(s.values[v][i]).toBeNull();
        }
      });
    }
  });
});

describe("ENVIRONMENT mode", () => {
  it("is observed context, not a health observation or model output", () => {
    expect(ENVIRONMENT_MODE.availability).toBe("observed");
    expect(ENVIRONMENT_MODE.evidence).toBe("context");
  });

  it("shows loading, then the error, before the bundle arrives", () => {
    expect(ENVIRONMENT_MODE.prepare!({} as MapDataBundle, filters("cchain")).timeline.slices).toHaveLength(0);
    const failed = ENVIRONMENT_MODE.prepare!({ environmentError: "HTTP 500" } as MapDataBundle, filters("cchain"));
    expect(failed.legend.metric).toContain("HTTP 500");
  });

  it("keeps each source on its own calendar and never splices them", () => {
    const cchain = prepare(filters("cchain")).timeline.slices;
    const openMeteo = prepare(filters("open_meteo")).timeline.slices;
    expect(cchain[0].key).toBe("2003-01-05");
    expect(cchain.at(-1)!.key <= "2022-12-31").toBe(true);
    expect(openMeteo[0].key).toBe("2007-12-30");
    expect(openMeteo.at(-1)!.key > "2026-01-01").toBe(true);

    // A 2024 week has no CCHAIN value anywhere, so the CCHAIN layer cannot draw it.
    const s = data.series.find((x) => x.sourceId === "cchain")!;
    expect(weekIndex(s, "2024-06-02")).toBe(-1);
  });

  it("draws incomplete weeks as no data, never as the lowest ramp class", () => {
    // The committed export has no incomplete weeks, so blank one in a copy.
    const copy = structuredClone(data);
    const target = copy.series.find((x) => x.sourceId === "cchain" && x.geographyId === "davao-city")!;
    const i = weekIndex(target, "2015-06-07");
    target.values.precipitation_mm[i] = null;
    target.daysObserved[i] = 5;
    const prepared = ENVIRONMENT_MODE.prepare!({ environment: copy } as MapDataBundle, filters("cchain"));
    const n = prepared.timeline.slices.findIndex((slice) => slice.key === "2015-06-07");
    const f = prepared.frameAt(n, toggles).features.find((x) => x.id === "davao-city")!;
    expect(f.color).toEqual(hexToRgba(ENVIRONMENT_NO_DATA_HEX, 220));
    expect(f.color).not.toEqual(hexToRgba(ENVIRONMENT_RAMP[0], 235));
    expect(f.classLabel).toBe("No data (incomplete week)");
    expect(f.rows[0].value).toBe("No data");
    expect(f.rows[1].value).toBe("5 of 7");
    expect(f.rank).toBe(Number.NEGATIVE_INFINITY);
  });

  it("marks a week with no data for any city as a gap in the timeline", () => {
    const slices = prepare(filters("cchain", "humidity_mean_pct")).timeline.slices;
    const step = 7 * 86_400_000;
    slices.forEach((slice, n) => {
      if (n > 0) expect(slice.gapBefore).toBe(Date.parse(slice.key) - Date.parse(slices[n - 1].key) > step);
    });
  });

  it("fades and labels provisional ERA5T weeks", () => {
    const prepared = prepare(filters("open_meteo", "temperature_mean_c"));
    const last = prepared.frameAt(prepared.timeline.slices.length - 1, toggles);
    const s = data.series.find((x) => x.sourceId === "open_meteo")!;
    expect(qcFlagsAt(s, s.daysObserved.length - 1)).toContain("provisional_era5t");
    for (const f of last.features.filter((x) => x.rows[0].value !== "No data")) {
      expect(f.classLabel).toContain("provisional");
      expect(f.color[3]).toBeLessThan(235);
    }
  });

  it("uses a one-hue ramp that darkens with the value and clamps outside the domain", () => {
    const lum = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const steps = [0, 0.25, 0.5, 0.75, 1].map((t) => lum(rampColor(t, [0, 1])));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]);
    expect(rampColor(-5, [0, 1])).toEqual(hexToRgba(ENVIRONMENT_RAMP[0], 235));
    expect(rampColor(9, [0, 1])).toEqual(hexToRgba(ENVIRONMENT_RAMP.at(-1)!, 235));
  });

  it("states that weather is context, and warns that rainfall sources disagree", () => {
    expect(prepare(filters("cchain", "temperature_mean_c")).legend.note).toBe(ENVIRONMENT_NOTE);
    expect(prepare(filters("cchain", "precipitation_mm")).legend.note).toMatch(/never mixed/);
  });
});
