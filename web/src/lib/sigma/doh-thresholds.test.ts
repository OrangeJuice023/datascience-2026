import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SigmaData } from "./data";

/**
 * The DOH thresholds in the committed map export follow the DOH Manual of
 * Procedures for the Philippine Integrated Disease Surveillance and Response,
 * 3rd ed. (2014), section 5.3.5: the average of the same week over past years
 * plus 1 SD (alert) or plus 2 SD (epidemic). SIGMA uses 3 past years.
 *
 * This recomputes them from the exported case counts, so a pipeline change
 * that drifts from the manual fails here. Weeks that use a documented
 * fallback (2 of 3 baseline years, week 53) are left out.
 */

const data: SigmaData = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../public/data/sigma/hdx-dengue-sigma.json", import.meta.url)), "utf8"),
);

const OK = data.meta.codes.quality.indexOf("ok");
const DOH = data.meta.codes.doh;

/** Epi (MMWR) year and week: the year holding the week's Wednesday, as in ml/clean_dengue.py. */
function epiWeek(periodStart: string): [number, number] {
  const wed = new Date(`${periodStart}T00:00:00Z`);
  wed.setUTCDate(wed.getUTCDate() + 3);
  const year = wed.getUTCFullYear();
  const dayOfYear = Math.floor((wed.getTime() - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
  return [year, Math.floor((dayOfYear - 1) / 7) + 1];
}

const epi = data.meta.weeks.map(epiWeek);
const index = new Map(epi.map(([y, w], i) => [`${y}-${w}`, i]));

function sampleSd(xs: number[]): number {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

interface Check {
  value: number | null;
  mean: number;
  sd: number;
  alert: number;
  epidemic: number;
  status: string;
}

const checks: Check[] = [];
for (const unit of data.units) {
  epi.forEach(([y, w], i) => {
    const alert = unit.alert[i];
    const epidemic = unit.epidemic[i];
    if (alert == null || epidemic == null || w === 53) return;
    const baseline = [1, 2, 3].map((j) => index.get(`${y - j}-${w}`));
    if (baseline.some((b) => b === undefined || unit.quality[b] !== OK || unit.value[b] == null)) return;
    const values = baseline.map((b) => unit.value[b as number] as number);
    const mean = values.reduce((s, x) => s + x, 0) / values.length;
    checks.push({ value: unit.value[i], mean, sd: sampleSd(values), alert, epidemic, status: DOH[unit.doh[i]] });
  });
}

describe("DOH thresholds in the map export (PIDSR MOP 2014, s5.3.5)", () => {
  it("has thousands of weeks with a full 3-year baseline to check", () => {
    expect(checks.length).toBeGreaterThan(10_000);
  });

  it("sets the alert threshold at the 3-year mean + 1 SD", () => {
    const off = checks.filter((c) => Math.abs(c.alert - (c.mean + c.sd)) > 0.051);
    expect(off).toHaveLength(0);
  });

  it("sets the epidemic threshold at the 3-year mean + 2 SD", () => {
    const off = checks.filter((c) => Math.abs(c.epidemic - (c.mean + 2 * c.sd)) > 0.051);
    expect(off).toHaveLength(0);
  });

  it("classes each week against those thresholds", () => {
    const wrong = checks.filter((c) => {
      if (c.status === "unreliable week" || c.value == null) return false;
      // Thresholds are exported rounded to 0.1; the status was set on the
      // unrounded value, so a case count within rounding of one is ambiguous.
      if (Math.abs(c.value - c.alert) <= 0.05 || Math.abs(c.value - c.epidemic) <= 0.05) return false;
      const expected = c.value > c.epidemic ? "epidemic" : c.value > c.alert ? "alert" : "normal";
      return c.status !== expected;
    });
    expect(wrong).toHaveLength(0);
  });
});
