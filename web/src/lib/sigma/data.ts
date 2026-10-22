/**
 * SIGMA reporting-unit series, as written by ml/export_sigma_web.py to
 * public/data/sigma/hdx-dengue-sigma.json. Series are column-wise arrays over
 * `meta.weeks`, with small integer codes (`meta.codes`) for the categorical
 * columns. A week that is not "ok" has a null value: missing and suspect-swap
 * weeks are no data, never zero.
 */

export const SIGMA_DATA_URL = "/data/sigma/hdx-dengue-sigma.json";
export const SIGMA_BOUNDARIES_URL = "/geo/hdx-reporting-units.geojson";

export type SigmaQuality = "ok" | "missing" | "suspect swap";
export type SigmaDohStatus = "no baseline" | "normal" | "alert" | "epidemic" | "unreliable week";
export type SigmaFlag = "possible non-reporting" | "one-week spike";

export interface SigmaUnitSeries {
  id: string;
  name: string;
  unitType: string;
  regionId: string;
  region: string;
  excludes: string[];
  /** Representative point inside the unit: a label position, not where cases occurred. */
  point: [longitude: number, latitude: number];
  mlName: string;
  value: Array<number | null>;
  quality: number[];
  flag: Array<number | null>;
  doh: number[];
  alert: Array<number | null>;
  epidemic: Array<number | null>;
  ears: number[];
  c1: Array<number | null>;
  c2: Array<number | null>;
  c3: Array<number | null>;
}

export interface SigmaData {
  meta: {
    description: string;
    source: string;
    isSample: boolean;
    weeks: string[];
    weekNote: string;
    codes: { quality: SigmaQuality[]; doh: SigmaDohStatus[]; ears: string[]; flag: SigmaFlag[] };
    ears: { c1c2Threshold: number; c3Threshold: number; minCount: number; baselineWeeks: number; minBaseline: number };
    doh: string;
    assumptions: string[];
  };
  units: SigmaUnitSeries[];
}

/** One unit at one week, decoded. */
export interface SigmaWeek {
  week: string;
  value: number | null;
  quality: SigmaQuality;
  flag: SigmaFlag | null;
  doh: SigmaDohStatus;
  alert: number | null;
  epidemic: number | null;
  /** "not computed", "none" or the methods that alarmed, e.g. "C2+C3". */
  ears: string;
  c1: number | null;
  c2: number | null;
  c3: number | null;
}

export function weekOf(data: SigmaData, unit: SigmaUnitSeries, index: number): SigmaWeek {
  const { codes } = data.meta;
  const flag = unit.flag[index];
  return {
    week: data.meta.weeks[index],
    value: unit.value[index],
    quality: codes.quality[unit.quality[index]],
    flag: flag === null ? null : codes.flag[flag],
    doh: codes.doh[unit.doh[index]],
    alert: unit.alert[index],
    epidemic: unit.epidemic[index],
    ears: codes.ears[unit.ears[index]],
    c1: unit.c1[index],
    c2: unit.c2[index],
    c3: unit.c3[index],
  };
}

export const hasData = (w: SigmaWeek) => w.quality === "ok" && w.value !== null;
export const isEarsAlarm = (w: SigmaWeek) => hasData(w) && w.ears !== "none" && w.ears !== "not computed";
export const isDohCrossing = (w: SigmaWeek) => hasData(w) && (w.doh === "alert" || w.doh === "epidemic");

export type EarsClass = "alarm" | "none" | "not_computed" | "no_data";
export type DohClass = "epidemic" | "alert" | "normal" | "no_baseline" | "no_data";

export function earsClass(w: SigmaWeek): EarsClass {
  if (!hasData(w)) return "no_data";
  if (w.ears === "not computed") return "not_computed";
  return w.ears === "none" ? "none" : "alarm";
}

export function dohClass(w: SigmaWeek): DohClass {
  if (!hasData(w) || w.doh === "unreliable week") return "no_data";
  if (w.doh === "no baseline") return "no_baseline";
  return w.doh;
}

const fmt = (v: number) => v.toFixed(1);

/** Plain-language reason for the week's EARS result. */
export function earsReason(w: SigmaWeek, data: SigmaData): string {
  const t = data.meta.ears;
  if (!hasData(w)) return w.quality === "suspect swap" ? "No result: suspect swap week (no data)" : "No result: missing week";
  if (w.ears === "not computed") {
    return `Not computed: fewer than ${t.minBaseline} of ${t.baselineWeeks} usable baseline weeks`;
  }
  const parts: string[] = [];
  if (w.c1 !== null) parts.push(`C1 ${fmt(w.c1)}${w.c1 > t.c1c2Threshold ? ` > ${t.c1c2Threshold}` : ""}`);
  if (w.c2 !== null) parts.push(`C2 ${fmt(w.c2)}${w.c2 > t.c1c2Threshold ? ` > ${t.c1c2Threshold}` : ""}`);
  if (w.c3 !== null) parts.push(`C3 ${fmt(w.c3)}${w.c3 > t.c3Threshold ? ` > ${t.c3Threshold}` : ""}`);
  const stats = parts.join(" · ");
  if (w.ears === "none") {
    const quiet = (w.value ?? 0) < t.minCount ? `; under ${t.minCount} cases cannot alarm` : "";
    return `No alarm (${stats || "no statistic"})${quiet}`;
  }
  return `${w.ears} alarm (${stats})`;
}

/** Plain-language reason for the week's DOH threshold status. */
export function dohReason(w: SigmaWeek): string {
  if (!hasData(w)) return "No data this week";
  if (w.doh === "no baseline") return "No threshold: needs 3 prior years (from 2019)";
  if (w.doh === "unreliable week") return "Not compared: week not usable";
  const a = w.alert === null ? "—" : fmt(w.alert);
  const e = w.epidemic === null ? "—" : fmt(w.epidemic);
  if (w.doh === "epidemic") return `${w.value} cases > epidemic threshold ${e}`;
  if (w.doh === "alert") return `${w.value} cases > alert threshold ${a} (epidemic ${e})`;
  return `${w.value} cases ≤ alert threshold ${a}`;
}

export interface SigmaCoverage {
  ok: number;
  missing: number;
  suspectSwap: number;
  firstWithData: string | null;
  lastWithData: string | null;
}

export function coverageOf(data: SigmaData, unit: SigmaUnitSeries): SigmaCoverage {
  const { codes, weeks } = data.meta;
  let ok = 0;
  let missing = 0;
  let suspectSwap = 0;
  let first: string | null = null;
  let last: string | null = null;
  unit.quality.forEach((q, i) => {
    const quality = codes.quality[q];
    if (quality === "ok" && unit.value[i] !== null) {
      ok++;
      first ??= weeks[i];
      last = weeks[i];
    } else if (quality === "suspect swap") suspectSwap++;
    else missing++;
  });
  return { ok, missing, suspectSwap, firstWithData: first, lastWithData: last };
}

/** Week indices in which at least one unit has data (a week with none is a gap in the record). */
export function weeksWithData(data: SigmaData): number[] {
  const okCode = data.meta.codes.quality.indexOf("ok");
  return data.meta.weeks
    .map((_, i) => i)
    .filter((i) => data.units.some((u) => u.quality[i] === okCode && u.value[i] !== null));
}
