import type { DengueSignalRecord, DengueSummaryPoint, DengueUnitRecord } from '@sigma/contracts';

/**
 * The numbers behind the Overview and Explore dashboards, kept out of the
 * screens so they can be tested. Every rule here follows the project's data
 * rules: a week with no record is skipped (never counted as zero cases), a
 * unit-year that could not be computed stays null, and a unit with no EARS
 * result is "no result", never "no signal".
 */

/** The window the HDX reporting-unit data covers; the national series is cut to it on the Overview. */
export const HDX_YEARS = [2016, 2017, 2018, 2019, 2020, 2021] as const;
/** Epi years with per-unit totals in /dengue/units (2021 holds a single week). */
export const UNIT_YEARS = [2016, 2017, 2018, 2019, 2020] as const;

export interface YearRange {
  from: number;
  to: number;
}

export const ALL_HDX: YearRange = { from: 2016, to: 2021 };

export function rangeLabel(range: YearRange): string {
  return range.from === range.to ? String(range.from) : `${range.from} – ${range.to}`;
}

export interface NationalStats {
  points: DengueSummaryPoint[];
  total: number;
  recordedWeeks: number;
  expectedWeeks: number;
  average: number | null;
  peak: { value: number; periodStart: string } | null;
}

/** Totals over the weeks of `range` that have a record; missing weeks are counted as missing, not as zero. */
export function nationalStats(points: DengueSummaryPoint[], range: YearRange): NationalStats {
  const inRange = points.filter((p) => p.epiYear >= range.from && p.epiYear <= range.to);
  let total = 0;
  let recorded = 0;
  let peak: NationalStats['peak'] = null;
  for (const p of inRange) {
    if (p.value === null) continue;
    total += p.value;
    recorded++;
    if (!peak || p.value > peak.value) peak = { value: p.value, periodStart: p.periodStart };
  }
  return {
    points: inRange,
    total,
    recordedWeeks: recorded,
    expectedWeeks: inRange.length,
    average: recorded > 0 ? total / recorded : null,
    peak,
  };
}

export type SignalClass = 'none' | 'C1' | 'C2' | 'C3' | 'no_result';

export const SIGNAL_CLASSES: SignalClass[] = ['none', 'C1', 'C2', 'C3', 'no_result'];

export const SIGNAL_LABEL: Record<SignalClass, string> = {
  none: 'No signal',
  C1: 'EARS C1',
  C2: 'EARS C2',
  C3: 'EARS C3',
  no_result: 'No result',
};

/**
 * One class per unit for one week: the highest EARS method that alarmed
 * (C3 > C2 > C1), "none" when results exist but none alarmed, and
 * "no_result" when the unit has no computed result that week.
 */
export function unitSignalClasses(records: DengueSignalRecord[], unitIds: string[]): Map<string, SignalClass> {
  const out = new Map<string, SignalClass>(unitIds.map((id) => [id, 'no_result']));
  const rank: Record<SignalClass, number> = { no_result: 0, none: 1, C1: 2, C2: 3, C3: 4 };
  for (const r of records) {
    const method = r.method.replace(/^EARS\s+/, '') as SignalClass;
    const cls: SignalClass = r.alarm && (method === 'C1' || method === 'C2' || method === 'C3') ? method : 'none';
    const current = out.get(r.geographyId) ?? 'no_result';
    if (rank[cls] > rank[current]) out.set(r.geographyId, cls);
  }
  return out;
}

export function countClasses<T extends string>(classes: Iterable<T>, order: readonly T[]): Record<T, number> {
  const counts = Object.fromEntries(order.map((k) => [k, 0])) as Record<T, number>;
  for (const c of classes) counts[c] = (counts[c] ?? 0) + 1;
  return counts;
}

export type MapLayer = 'ears' | 'doh' | 'cases';

export const LAYER_LABEL: Record<MapLayer, string> = {
  ears: 'EARS alarms',
  doh: 'DOH thresholds',
  cases: 'Reported cases',
};

/**
 * A unit's value for a layer over the chosen years: the sum of the
 * unit-years that could be computed, or null when none could (e.g. DOH
 * thresholds before 2019, or a unit with no usable weeks).
 */
export function unitValue(unit: DengueUnitRecord, layer: MapLayer, years: readonly number[]): number | null {
  const t = unitTotals(unit, layer, years);
  return t.years > 0 ? t.sum : null;
}

/**
 * Alarm (or threshold) weeks per computable year, so "all years" and a single
 * year read on the same scale; null when no year could be computed. EARS
 * alarms at the start of every season, so a five-year sum would put almost
 * every unit in the top bin.
 */
export function unitWeeksPerYear(unit: DengueUnitRecord, layer: 'ears' | 'doh', years: readonly number[]): number | null {
  const t = unitTotals(unit, layer, years);
  return t.years > 0 ? t.sum / t.years : null;
}

function unitTotals(unit: DengueUnitRecord, layer: MapLayer, years: readonly number[]): { sum: number; years: number } {
  let sum = 0;
  let n = 0;
  for (const y of unit.years) {
    if (!years.includes(y.year)) continue;
    const v = layer === 'ears' ? y.earsWeeks : layer === 'doh' ? y.dohWeeks : y.cases;
    if (v === null || v === undefined) continue;
    sum += v;
    n++;
  }
  return { sum, years: n };
}

export type WeekBin = 'zero' | 'low' | 'mid' | 'high' | 'no_result';

export const WEEK_BINS: WeekBin[] = ['zero', 'low', 'mid', 'high', 'no_result'];

/**
 * Bin cut-offs in weeks a year, per layer. Set from the 2016-2020 spread
 * across units (EARS: quartiles about 8 / 10 / 12; DOH threshold weeks,
 * 2019-2020: about 12 / 16 / 20), so the all-years map is not one colour.
 */
export const WEEK_CUTS: Record<'ears' | 'doh', [number, number]> = { ears: [6, 12], doh: [10, 20] };

export function weekBinLabels(cuts: [number, number]): Record<WeekBin, string> {
  return {
    zero: 'None',
    low: `Under ${cuts[0]} a year`,
    mid: `${cuts[0]} – ${cuts[1]} a year`,
    high: `Over ${cuts[1]} a year`,
    no_result: 'No result',
  };
}

/** Bins alarm (or threshold) weeks per year; null stays "no result". */
export function binWeeks(perYear: number | null, cuts: [number, number]): WeekBin {
  if (perYear === null) return 'no_result';
  if (perYear === 0) return 'zero';
  if (perYear < cuts[0]) return 'low';
  if (perYear <= cuts[1]) return 'mid';
  return 'high';
}

/** Marker radius for a case count: area proportional to the count, so a city with 4x the cases has 2x the radius. */
export function caseRadius(cases: number | null, maxCases: number, maxRadius: number, minRadius = 2): number {
  if (cases === null || cases <= 0 || maxCases <= 0) return 0;
  return Math.max(minRadius, Math.sqrt(cases / maxCases) * maxRadius);
}
