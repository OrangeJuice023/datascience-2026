import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { DengueSignalRecord, DengueSummaryPoint, DengueUnitRecord } from "@sigma/contracts";

import { boundariesUrl, projectBoundaries, type Boundaries } from "../api/geo";
import {
  binWeeks,
  caseRadius,
  countClasses,
  nationalStats,
  SIGNAL_CLASSES,
  unitSignalClasses,
  unitValue,
  unitWeeksPerYear,
} from "./dashboard-data";

const point = (periodStart: string, epiYear: number, value: number | null): DengueSummaryPoint => ({
  periodStart,
  periodEnd: periodStart,
  value,
  epiYear,
  epiWeek: 1,
});

describe("nationalStats", () => {
  const points = [
    point("2015-12-27", 2015, 900),
    point("2016-01-03", 2016, 100),
    point("2016-01-10", 2016, null), // missing week: not a zero
    point("2016-01-17", 2016, 300),
    point("2017-01-01", 2017, 200),
  ];

  it("sums recorded weeks only and counts the missing one as missing", () => {
    const s = nationalStats(points, { from: 2016, to: 2016 });
    expect(s.total).toBe(400);
    expect(s.recordedWeeks).toBe(2);
    expect(s.expectedWeeks).toBe(3);
    expect(s.average).toBe(200);
    expect(s.peak).toEqual({ value: 300, periodStart: "2016-01-17" });
  });

  it("has no average or peak when no week is recorded", () => {
    const s = nationalStats([point("2016-01-10", 2016, null)], { from: 2016, to: 2016 });
    expect(s.average).toBeNull();
    expect(s.peak).toBeNull();
  });
});

const rec = (geographyId: string, method: string, alarm: boolean): DengueSignalRecord => ({
  id: `${geographyId}:${method}`,
  geographyId,
  periodStart: "2021-01-03",
  periodEnd: "2021-01-09",
  method,
  value: alarm ? 5 : 0,
  threshold: 3,
  alarm,
});

describe("unitSignalClasses", () => {
  it("takes the highest method that alarmed, and keeps units without results as no_result", () => {
    const classes = unitSignalClasses(
      [rec("a", "EARS C1", true), rec("a", "EARS C3", true), rec("b", "EARS C1", false), rec("b", "EARS C2", false), rec("c", "EARS C2", true)],
      ["a", "b", "c", "d"],
    );
    expect(Object.fromEntries(classes)).toEqual({ a: "C3", b: "none", c: "C2", d: "no_result" });
    expect(countClasses(classes.values(), SIGNAL_CLASSES)).toEqual({ none: 1, C1: 0, C2: 1, C3: 1, no_result: 1 });
  });
});

describe("unitValue and bins", () => {
  const unit: DengueUnitRecord = {
    id: "x",
    name: "X",
    unitType: "city_huc",
    regionId: "r",
    years: [
      { year: 2018, cases: 50, usableWeeks: 52, weeks: 52, earsWeeks: 3, earsEvaluatedWeeks: 50, dohWeeks: null, dohEvaluatedWeeks: 0 },
      { year: 2019, cases: 400, usableWeeks: 52, weeks: 52, earsWeeks: 8, earsEvaluatedWeeks: 52, dohWeeks: 12, dohEvaluatedWeeks: 52 },
    ],
  } as DengueUnitRecord;

  it("sums computable unit-years and returns null when none were computable", () => {
    expect(unitValue(unit, "ears", [2018, 2019])).toBe(11);
    expect(unitValue(unit, "doh", [2018])).toBeNull();
    expect(unitValue(unit, "doh", [2018, 2019])).toBe(12);
    expect(unitValue(unit, "cases", [2016])).toBeNull();
  });

  it("averages alarm weeks over the years that could be computed", () => {
    expect(unitWeeksPerYear(unit, "ears", [2018, 2019])).toBe(5.5);
    expect(unitWeeksPerYear(unit, "doh", [2018, 2019])).toBe(12); // 2018 has no DOH baseline: not a zero year
    expect(unitWeeksPerYear(unit, "doh", [2018])).toBeNull();
  });

  it("bins weeks per year, with null as no_result and zero as its own class", () => {
    expect([null, 0, 0.5, 3.9, 4, 8, 8.5].map((v) => binWeeks(v, [4, 8]))).toEqual(["no_result", "zero", "low", "low", "mid", "mid", "high"]);
  });

  it("scales marker area, not radius, with the count", () => {
    expect(caseRadius(100, 400, 20)).toBeCloseTo(10);
    expect(caseRadius(0, 400, 20)).toBe(0);
    expect(caseRadius(null, 400, 20)).toBe(0);
  });
});

describe("boundaries", () => {
  it("builds the boundaries URL from the API address", () => {
    expect(boundariesUrl("https://datascience-2026.vercel.app/api/v1")).toBe(
      "https://datascience-2026.vercel.app/geo/hdx-reporting-units.geojson",
    );
    expect(boundariesUrl("http://10.0.2.2:3000/api/v1/")).toBe("http://10.0.2.2:3000/geo/hdx-reporting-units.geojson");
  });

  it("projects all 126 committed units into the frame, with centres inside it", () => {
    const geo = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../web/public/geo/hdx-reporting-units.geojson", import.meta.url)), "utf8"),
    ) as Boundaries;
    const map = projectBoundaries(geo, 300);
    expect(map.units).toHaveLength(126);
    expect(map.height).toBeGreaterThan(map.width); // the archipelago is taller than wide
    for (const u of map.units) {
      expect(u.d.startsWith("M")).toBe(true);
      expect(u.center[0]).toBeGreaterThanOrEqual(0);
      expect(u.center[0]).toBeLessThanOrEqual(300);
      expect(u.center[1]).toBeGreaterThanOrEqual(0);
      expect(u.center[1]).toBeLessThanOrEqual(map.height);
    }
    // About 1,850 km north-south (Batanes to Tawi-Tawi).
    expect(map.height / map.unitsPerKm).toBeGreaterThan(1600);
    expect(map.height / map.unitsPerKm).toBeLessThan(2100);
  });
});
