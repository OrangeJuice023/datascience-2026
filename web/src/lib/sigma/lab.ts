import { epiWeek, epiWeeksInYear } from "@/lib/national-observations";
import {
  dohClass,
  earsClass,
  hasData,
  isDohCrossing,
  isEarsAlarm,
  weekOf,
  type SigmaData,
  type SigmaFlag,
  type SigmaUnitSeries,
} from "./data";

/**
 * Lab analysis of the SIGMA reporting-unit export
 * (public/data/sigma/hdx-dengue-sigma.json): per-unit epi-year summaries and
 * the data-quality counts behind the Method tab. Pure functions, so the
 * server computes the small summaries and the client the per-unit tables from
 * the same code.
 *
 * Every count uses usable ("ok") weeks only. Missing and suspect-swap weeks
 * are counted as no data, never as zero, and never fill a sum.
 */

export const UNIT_TYPE_LABEL: Record<string, string> = {
  province_full: "Province",
  province_remainder: "Province, excluding separately reported cities",
  city_huc: "Highly urbanized city",
  city_icc: "Independent component city",
  city_cc: "Component city (reported separately)",
  municipality: "Municipality",
};

export interface SigmaUnitOption {
  id: string;
  name: string;
  region: string;
  unitType: string;
}

/**
 * Which came first within one epi year: the first EARS alarm week or the
 * first week above a DOH threshold. "no-doh-threshold" when no week of the
 * year could be compared with a DOH threshold (before 2019: they need three
 * prior years).
 */
export type FirstSignal =
  | "ears-first"
  | "same-week"
  | "doh-first"
  | "ears-only"
  | "doh-only"
  | "neither"
  | "no-doh-threshold";

export const FIRST_SIGNALS: FirstSignal[] = [
  "ears-first",
  "same-week",
  "doh-first",
  "ears-only",
  "doh-only",
  "neither",
  "no-doh-threshold",
];

export const FIRST_SIGNAL_LABEL: Record<FirstSignal, string> = {
  "ears-first": "EARS first",
  "same-week": "Same week",
  "doh-first": "DOH threshold first",
  "ears-only": "EARS alarm only",
  "doh-only": "DOH threshold only",
  neither: "Neither",
  "no-doh-threshold": "No DOH threshold",
};

export interface UnitYearRow {
  /** MMWR epi year (the year holding the week's Wednesday). */
  year: number;
  /** Weeks of this epi year in the export. */
  weeks: number;
  /** Weeks the epi year has (52 or 53); more than `weeks` at the edges of the export. */
  weeksInYear: number;
  usableWeeks: number;
  missingWeeks: number;
  swapWeeks: number;
  /** Sum over usable weeks only; null when the year has none. Not an annual total unless every week is usable. */
  reportedCases: number | null;
  earsAlarmWeeks: number;
  /** Usable weeks with an EARS result (alarm or none). */
  earsEvaluatedWeeks: number;
  /** Usable weeks compared with a DOH threshold (normal, alert or epidemic). */
  dohEvaluatedWeeks: number;
  dohAlertWeeks: number;
  dohEpidemicWeeks: number;
  firstEarsAlarm: string | null;
  firstDohCrossing: string | null;
  firstSignal: FirstSignal;
  /** Weeks from the first EARS alarm to the first DOH-threshold week (negative: DOH first). Null unless both exist. */
  leadWeeks: number | null;
}

const WEEK_MS = 7 * 86_400_000;

function weeksBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / WEEK_MS);
}

export function compareFirst(
  firstEarsAlarm: string | null,
  firstDohCrossing: string | null,
  dohEvaluated: boolean,
): { firstSignal: FirstSignal; leadWeeks: number | null } {
  if (!dohEvaluated) return { firstSignal: "no-doh-threshold", leadWeeks: null };
  if (firstEarsAlarm && firstDohCrossing) {
    const lead = weeksBetween(firstEarsAlarm, firstDohCrossing);
    return { firstSignal: lead > 0 ? "ears-first" : lead < 0 ? "doh-first" : "same-week", leadWeeks: lead };
  }
  if (firstEarsAlarm) return { firstSignal: "ears-only", leadWeeks: null };
  if (firstDohCrossing) return { firstSignal: "doh-only", leadWeeks: null };
  return { firstSignal: "neither", leadWeeks: null };
}

/** One row per epi year of the export for one reporting unit. */
export function summarizeUnitYears(data: SigmaData, unit: SigmaUnitSeries): UnitYearRow[] {
  const rows = new Map<number, UnitYearRow>();
  data.meta.weeks.forEach((iso, i) => {
    const year = epiWeek(iso).year;
    let row = rows.get(year);
    if (!row) {
      row = {
        year,
        weeks: 0,
        weeksInYear: epiWeeksInYear(year),
        usableWeeks: 0,
        missingWeeks: 0,
        swapWeeks: 0,
        reportedCases: null,
        earsAlarmWeeks: 0,
        earsEvaluatedWeeks: 0,
        dohEvaluatedWeeks: 0,
        dohAlertWeeks: 0,
        dohEpidemicWeeks: 0,
        firstEarsAlarm: null,
        firstDohCrossing: null,
        firstSignal: "no-doh-threshold",
        leadWeeks: null,
      };
      rows.set(year, row);
    }
    row.weeks++;
    const w = weekOf(data, unit, i);
    if (!hasData(w)) {
      if (w.quality === "suspect swap") row.swapWeeks++;
      else row.missingWeeks++;
      return;
    }
    row.usableWeeks++;
    row.reportedCases = (row.reportedCases ?? 0) + (w.value as number);
    const ears = earsClass(w);
    if (ears === "alarm" || ears === "none") row.earsEvaluatedWeeks++;
    if (isEarsAlarm(w)) {
      row.earsAlarmWeeks++;
      row.firstEarsAlarm ??= iso;
    }
    const doh = dohClass(w);
    if (doh === "normal" || doh === "alert" || doh === "epidemic") row.dohEvaluatedWeeks++;
    if (doh === "alert") row.dohAlertWeeks++;
    if (doh === "epidemic") row.dohEpidemicWeeks++;
    if (isDohCrossing(w)) row.firstDohCrossing ??= iso;
  });

  return [...rows.values()]
    .sort((a, b) => a.year - b.year)
    .map((row) => ({ ...row, ...compareFirst(row.firstEarsAlarm, row.firstDohCrossing, row.dohEvaluatedWeeks > 0) }));
}

export interface SigmaQualitySummary {
  unitWeeks: number;
  usable: number;
  missing: number;
  suspectSwap: number;
  /** Weeks in which no reporting unit has a usable value. */
  emptyWeeks: string[];
  /** Weeks missing for more than one unit, with how many. */
  sharedMissingWeeks: Array<{ week: string; units: number }>;
  /** How many units have each count of missing weeks, most first; names listed for small groups. */
  missingPerUnit: Array<{ missingWeeks: number; units: number; names: string[] }>;
  /** Suspect cases/deaths swap rows, grouped by epi year. */
  swapByYear: Array<{ year: number; weeks: string[]; units: number; rows: number }>;
  /** Usable unit-weeks carrying each data flag (values kept as published). */
  flagged: Record<SigmaFlag, number>;
  /** Usable unit-weeks with no EARS result (too few usable baseline weeks). */
  earsNotComputed: number;
  /** First week with any DOH threshold, and its epi year. */
  dohFirstWeek: string | null;
  dohFirstYear: number | null;
  /** Usable unit-weeks from dohFirstWeek on with no DOH threshold (fewer than 2 usable baseline years). */
  dohNoBaseline: number;
}

export interface FirstSignalYear {
  year: number;
  /** Weeks of this epi year in the export. */
  weeks: number;
  weeksInYear: number;
  counts: Record<FirstSignal, number>;
}

export interface SigmaLabSummary {
  /** The reporting units, sorted by name. */
  units: SigmaUnitOption[];
  firstWeek: string;
  lastWeek: string;
  weekCount: number;
  meta: Pick<SigmaData["meta"], "description" | "source" | "isSample" | "weekNote" | "ears" | "doh" | "assumptions">;
  quality: SigmaQualitySummary;
  /** Across all units, per epi year that has DOH thresholds: which came first. */
  firstSignalByYear: FirstSignalYear[];
}

export function summarizeSigmaQuality(data: SigmaData): SigmaQualitySummary {
  const { weeks, codes } = data.meta;
  const usablePerWeek = new Array<number>(weeks.length).fill(0);
  const missingPerWeek = new Array<number>(weeks.length).fill(0);
  const swap = new Map<number, { weeks: Set<string>; units: Set<string>; rows: number }>();
  const missingCounts = new Map<number, string[]>();
  const flagged = Object.fromEntries(codes.flag.map((f) => [f, 0])) as Record<SigmaFlag, number>;
  let usable = 0;
  let missing = 0;
  let suspectSwap = 0;
  let earsNotComputed = 0;
  let dohNoBaseline = 0;
  let dohFirstIndex = -1;

  for (const unit of data.units) {
    unit.alert.forEach((a, i) => {
      if (a !== null && (dohFirstIndex < 0 || i < dohFirstIndex)) dohFirstIndex = i;
    });
  }

  for (const unit of data.units) {
    let unitMissing = 0;
    weeks.forEach((iso, i) => {
      const w = weekOf(data, unit, i);
      if (!hasData(w)) {
        if (w.quality === "suspect swap") {
          suspectSwap++;
          const year = epiWeek(iso).year;
          const entry = swap.get(year) ?? { weeks: new Set<string>(), units: new Set<string>(), rows: 0 };
          entry.weeks.add(iso);
          entry.units.add(unit.id);
          entry.rows++;
          swap.set(year, entry);
        } else {
          missing++;
          unitMissing++;
          missingPerWeek[i]++;
        }
        return;
      }
      usable++;
      usablePerWeek[i]++;
      if (w.flag) flagged[w.flag]++;
      if (earsClass(w) === "not_computed") earsNotComputed++;
      if (dohFirstIndex >= 0 && i >= dohFirstIndex && dohClass(w) === "no_baseline") dohNoBaseline++;
    });
    missingCounts.set(unitMissing, [...(missingCounts.get(unitMissing) ?? []), unit.name]);
  }

  return {
    unitWeeks: data.units.length * weeks.length,
    usable,
    missing,
    suspectSwap,
    emptyWeeks: weeks.filter((_, i) => usablePerWeek[i] === 0),
    sharedMissingWeeks: weeks.flatMap((week, i) => (missingPerWeek[i] > 1 ? [{ week, units: missingPerWeek[i] }] : [])),
    missingPerUnit: [...missingCounts.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([missingWeeks, names]) => ({
        missingWeeks,
        units: names.length,
        names: names.length <= 3 ? [...names].sort() : [],
      })),
    swapByYear: [...swap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, e]) => ({ year, weeks: [...e.weeks].sort(), units: e.units.size, rows: e.rows })),
    flagged,
    earsNotComputed,
    dohFirstWeek: dohFirstIndex >= 0 ? weeks[dohFirstIndex] : null,
    dohFirstYear: dohFirstIndex >= 0 ? epiWeek(weeks[dohFirstIndex]).year : null,
    dohNoBaseline,
  };
}

/** The small, serializable part of the export the Lab needs before the full series is fetched. */
export function summarizeSigmaLab(data: SigmaData): SigmaLabSummary {
  const { meta } = data;
  const byYear = new Map<number, FirstSignalYear>();
  for (const unit of data.units) {
    for (const row of summarizeUnitYears(data, unit)) {
      if (row.firstSignal === "no-doh-threshold") continue;
      const entry =
        byYear.get(row.year) ??
        ({
          year: row.year,
          weeks: row.weeks,
          weeksInYear: row.weeksInYear,
          counts: Object.fromEntries(FIRST_SIGNALS.map((s) => [s, 0])) as Record<FirstSignal, number>,
        } satisfies FirstSignalYear);
      entry.counts[row.firstSignal]++;
      byYear.set(row.year, entry);
    }
  }

  return {
    units: data.units
      .map((u) => ({ id: u.id, name: u.name, region: u.region, unitType: u.unitType }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    firstWeek: meta.weeks[0],
    lastWeek: meta.weeks[meta.weeks.length - 1],
    weekCount: meta.weeks.length,
    meta: {
      description: meta.description,
      source: meta.source,
      isSample: meta.isSample,
      weekNote: meta.weekNote,
      ears: meta.ears,
      doh: meta.doh,
      assumptions: meta.assumptions,
    },
    quality: summarizeSigmaQuality(data),
    firstSignalByYear: [...byYear.values()].sort((a, b) => a.year - b.year),
  };
}
