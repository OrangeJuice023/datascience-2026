import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasData, weekOf, type SigmaData } from "@/lib/sigma/data";
import { earsSignals, latestEarsWeek } from "./dengue-signals";

const data = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../public/data/sigma/hdx-dengue-sigma.json", import.meta.url)), "utf8"),
) as SigmaData;

describe("earsSignals", () => {
  it("defaults to the latest week with an EARS result, across units", () => {
    const { records, weeks } = earsSignals(data);
    expect(weeks).toEqual([data.meta.weeks[latestEarsWeek(data)]]);
    expect(records.length).toBeGreaterThan(0);
    expect(new Set(records.map((r) => r.periodStart))).toEqual(new Set(weeks));
  });

  it("never emits a record for a missing or suspect-swap week", () => {
    const unit = data.units.find((u) => u.quality.some((q) => data.meta.codes.quality[q] === "suspect swap"))!;
    const { records } = earsSignals(data, { unitId: unit.id });
    for (const r of records) {
      const w = data.meta.weeks.indexOf(r.periodStart);
      expect(hasData(weekOf(data, unit, w))).toBe(true);
    }
    const bad = data.meta.weeks.filter((_, w) => !hasData(weekOf(data, unit, w)));
    expect(bad.length).toBeGreaterThan(0);
    expect(records.some((r) => bad.includes(r.periodStart))).toBe(false);
  });

  it("matches the export's alarm label, including the minimum-count rule", () => {
    const unit = data.units[0];
    const { records } = earsSignals(data, { unitId: unit.id });
    for (const r of records) {
      const label = weekOf(data, unit, data.meta.weeks.indexOf(r.periodStart)).ears;
      expect(r.alarm).toBe(label.split("+").includes(r.method.replace("EARS ", "")));
      if (r.alarm) expect(r.value).toBeGreaterThan(r.threshold);
    }
  });

  it("returns one week for one unit when both are given, and nothing for an unknown week", () => {
    const week = "2019-07-14";
    const { records } = earsSignals(data, { unitId: "iloilo-city", week });
    expect(records.every((r) => r.periodStart === week && r.geographyId === "iloilo-city")).toBe(true);
    expect(earsSignals(data, { week: "2019-07-15" }).records).toEqual([]);
  });

  it("gives every record a 7-day period and a method threshold from the export", () => {
    for (const r of earsSignals(data).records) {
      const days = (Date.parse(r.periodEnd) - Date.parse(r.periodStart)) / 86_400_000;
      expect(days).toBe(6);
      expect(r.threshold).toBe(r.method === "EARS C3" ? data.meta.ears.c3Threshold : data.meta.ears.c1c2Threshold);
    }
  });
});
