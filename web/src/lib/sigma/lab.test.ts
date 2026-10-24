import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { coverageOf, type SigmaData } from "./data";
import { compareFirst, summarizeSigmaLab, summarizeSigmaQuality, summarizeUnitYears } from "./lab";

/**
 * The Lab's reporting-unit tables, checked against the committed export:
 * sums use usable weeks only, missing and suspect-swap weeks are counted as
 * no data, and no DOH comparison is claimed before thresholds exist.
 */

const data: SigmaData = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../public/data/sigma/hdx-dengue-sigma.json", import.meta.url)), "utf8"),
);
const OK = data.meta.codes.quality.indexOf("ok");

describe("compareFirst", () => {
  it("says which came first, and by how many weeks", () => {
    expect(compareFirst("2019-01-13", "2019-02-03", true)).toEqual({ firstSignal: "ears-first", leadWeeks: 3 });
    expect(compareFirst("2019-02-03", "2019-01-13", true)).toEqual({ firstSignal: "doh-first", leadWeeks: -3 });
    expect(compareFirst("2019-02-03", "2019-02-03", true)).toEqual({ firstSignal: "same-week", leadWeeks: 0 });
    expect(compareFirst("2019-02-03", null, true).firstSignal).toBe("ears-only");
    expect(compareFirst(null, "2019-02-03", true).firstSignal).toBe("doh-only");
    expect(compareFirst(null, null, true).firstSignal).toBe("neither");
  });

  it("makes no comparison without a DOH threshold", () => {
    expect(compareFirst("2017-02-05", null, false)).toEqual({ firstSignal: "no-doh-threshold", leadWeeks: null });
  });
});

describe("summarizeUnitYears", () => {
  it("sums usable weeks only and accounts for every week", () => {
    for (const unit of data.units) {
      const rows = summarizeUnitYears(data, unit);
      const coverage = coverageOf(data, unit);
      expect(rows.reduce((s, r) => s + r.weeks, 0)).toBe(data.meta.weeks.length);
      expect(rows.reduce((s, r) => s + r.usableWeeks, 0)).toBe(coverage.ok);
      expect(rows.reduce((s, r) => s + r.missingWeeks, 0)).toBe(coverage.missing);
      expect(rows.reduce((s, r) => s + r.swapWeeks, 0)).toBe(coverage.suspectSwap);
      const okSum = unit.value.reduce<number>((s, v, i) => (unit.quality[i] === OK && v !== null ? s + v : s), 0);
      expect(rows.reduce((s, r) => s + (r.reportedCases ?? 0), 0)).toBe(okSum);
      for (const r of rows) {
        if (r.usableWeeks === 0) expect(r.reportedCases).toBeNull();
        expect(r.dohAlertWeeks + r.dohEpidemicWeeks).toBeLessThanOrEqual(r.dohEvaluatedWeeks);
        expect(r.earsAlarmWeeks).toBeLessThanOrEqual(r.earsEvaluatedWeeks);
      }
    }
  });

  it("claims no DOH comparison before 2019", () => {
    for (const unit of data.units) {
      for (const r of summarizeUnitYears(data, unit)) {
        if (r.year < 2019) {
          expect(r.dohEvaluatedWeeks).toBe(0);
          expect(r.firstSignal).toBe("no-doh-threshold");
        }
      }
    }
  });
});

describe("summarizeSigmaQuality", () => {
  const q = summarizeSigmaQuality(data);

  it("splits every unit-week into usable, missing or suspect swap", () => {
    expect(q.usable + q.missing + q.suspectSwap).toBe(q.unitWeeks);
    expect(q.unitWeeks).toBe(126 * data.meta.weeks.length);
    expect(q.suspectSwap).toBe(665);
    expect(q.swapByYear.reduce((s, y) => s + y.rows, 0)).toBe(665);
    expect(q.missingPerUnit.reduce((s, g) => s + g.units, 0)).toBe(126);
  });

  it("finds the week with no data anywhere and the first DOH threshold", () => {
    expect(q.emptyWeeks).toEqual(["2019-01-06"]);
    expect(q.dohFirstYear).toBe(2019);
    expect(q.dohFirstWeek).not.toBeNull();
  });
});

describe("summarizeSigmaLab", () => {
  it("lists every unit and counts one first-signal result per unit and DOH year", () => {
    const s = summarizeSigmaLab(data);
    expect(s.units).toHaveLength(126);
    expect(s.meta.isSample).toBe(false);
    for (const y of s.firstSignalByYear) {
      expect(y.year).toBeGreaterThanOrEqual(2019);
      expect(Object.values(y.counts).reduce((a, b) => a + b, 0)).toBe(126);
    }
  });
});
