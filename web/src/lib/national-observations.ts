import type { HealthObservation } from "@/types/data";

/**
 * Shaping and summary statistics for formal national observations.
 *
 * Rules, enforced here so no component has to remember them:
 * - Weekly, monthly and yearly rows are separate reporting streams and are
 *   never summed into one another.
 * - Missing weeks are detected and surfaced; they are never zero-filled or
 *   interpolated. Chart series carry `value: null` for a missing week.
 * - Statistics use recorded weeks only and say how many they used.
 * - Weeks are assigned to MMWR epidemiological weeks (Sunday–Saturday;
 *   week 1 is the first week with at least four days in the new year),
 *   computed from each period's start date.
 */

const DAY_MS = 86_400_000;

function toUtc(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

function isoFromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** MMWR epi year/week for a Sunday–Saturday week, keyed on its Wednesday. */
export function epiWeek(periodStart: string): { year: number; week: number } {
  const wednesday = new Date(toUtc(periodStart) + 3 * DAY_MS);
  const year = wednesday.getUTCFullYear();
  const dayOfYear = Math.floor((wednesday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS);
  return { year, week: Math.floor(dayOfYear / 7) + 1 };
}

/** 52 or 53: the number of MMWR weeks (Wednesdays) in an epi year. */
export function epiWeeksInYear(year: number): number {
  const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return jan1 === 3 || (leap && jan1 === 2) ? 53 : 52;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface WeeklyPoint {
  periodStart: string;
  periodEnd: string;
  /** Null marks a week with no record in the source. */
  value: number | null;
  epiYear: number;
  epiWeek: number;
  sourceRecordId: string | null;
}

export interface CoverageGap {
  /** First missing week (period start). */
  from: string;
  /** Last missing week (period start). */
  to: string;
  missingWeeks: number;
}

export interface EpiYearSummary {
  year: number;
  recordedWeeks: number;
  expectedWeeks: number;
  complete: boolean;
  /** Incomplete because the record starts or ends inside this year, not because of gaps. */
  truncated: boolean;
  /** Sum of recorded weeks; an annual total only when `complete`. */
  recordedSum: number;
}

export interface SeasonalWeek {
  week: number;
  median: number | null;
  min: number | null;
  max: number | null;
  /** Number of epi years with a record for this week. */
  years: number;
}

export interface StreamPoint {
  periodStart: string;
  periodEnd: string;
  value: number;
  sourceRecordId: string | null;
}

export interface NationalSummary {
  weekly: {
    /** Continuous weekly timeline from first to last record, gaps as null. */
    series: WeeklyPoint[];
    recorded: number;
    expected: number;
    first: string | null;
    last: string | null;
    gaps: CoverageGap[];
    stats: {
      mean: number;
      median: number;
      min: { value: number; periodStart: string };
      max: { value: number; periodStart: string };
    } | null;
    epiYears: EpiYearSummary[];
    seasonal: SeasonalWeek[];
    /** Record-id prefix (upstream origin) → weeks, per epi year. */
    originsByYear: Array<{ year: number; origins: Record<string, number> }>;
  };
  yearly: StreamPoint[];
  monthly: StreamPoint[];
  caseDefinitions: string[];
}

function recordId(o: HealthObservation): string | null {
  return o.provenance.upstreamId ?? null;
}

function toStream(observations: HealthObservation[]): StreamPoint[] {
  return observations
    .map((o) => ({
      periodStart: o.periodStart,
      periodEnd: o.periodEnd,
      value: o.value,
      sourceRecordId: recordId(o),
    }))
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

export function summarizeNational(observations: HealthObservation[]): NationalSummary {
  const weeklyObs = observations
    .filter((o) => o.temporalResolution === "weekly")
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));

  const byStart = new Map(weeklyObs.map((o) => [o.periodStart, o]));
  const series: WeeklyPoint[] = [];
  const gaps: CoverageGap[] = [];

  if (weeklyObs.length > 0) {
    const firstMs = toUtc(weeklyObs[0].periodStart);
    const lastMs = toUtc(weeklyObs[weeklyObs.length - 1].periodStart);
    let gapStart: string | null = null;
    let gapLength = 0;
    for (let ms = firstMs; ms <= lastMs; ms += 7 * DAY_MS) {
      const start = isoFromUtc(ms);
      const obs = byStart.get(start);
      const { year, week } = epiWeek(start);
      series.push({
        periodStart: start,
        periodEnd: obs?.periodEnd ?? isoFromUtc(ms + 6 * DAY_MS),
        value: obs ? obs.value : null,
        epiYear: year,
        epiWeek: week,
        sourceRecordId: obs ? recordId(obs) : null,
      });
      if (!obs) {
        gapStart ??= start;
        gapLength++;
      } else if (gapStart) {
        gaps.push({ from: gapStart, to: isoFromUtc(ms - 7 * DAY_MS), missingWeeks: gapLength });
        gapStart = null;
        gapLength = 0;
      }
    }
  }

  const values = weeklyObs.map((o) => o.value);
  const sorted = [...values].sort((a, b) => a - b);
  const maxObs = weeklyObs.reduce<HealthObservation | null>((m, o) => (!m || o.value > m.value ? o : m), null);
  const minObs = weeklyObs.reduce<HealthObservation | null>((m, o) => (!m || o.value < m.value ? o : m), null);

  const years = new Map<number, { recorded: number; sum: number; origins: Record<string, number> }>();
  const byWeek = new Map<number, number[]>();
  for (const point of series) {
    const entry = years.get(point.epiYear) ?? { recorded: 0, sum: 0, origins: {} };
    if (point.value !== null) {
      entry.recorded++;
      entry.sum += point.value;
      const origin = point.sourceRecordId?.split("-")[0] ?? "unknown";
      entry.origins[origin] = (entry.origins[origin] ?? 0) + 1;
      const list = byWeek.get(point.epiWeek) ?? [];
      list.push(point.value);
      byWeek.set(point.epiWeek, list);
    }
    years.set(point.epiYear, entry);
  }

  const firstYear = series[0]?.epiYear;
  const lastYear = series[series.length - 1]?.epiYear;
  const epiYears: EpiYearSummary[] = [...years.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, e]) => {
      const expectedWeeks = epiWeeksInYear(year);
      const inYear = series.filter((p) => p.epiYear === year);
      const complete = e.recorded === expectedWeeks;
      return {
        year,
        recordedWeeks: e.recorded,
        expectedWeeks,
        complete,
        // Every week between the record's edges is present; the shortfall is
        // the record starting or ending mid-year.
        truncated:
          !complete &&
          (year === firstYear || year === lastYear) &&
          inYear.every((p) => p.value !== null),
        recordedSum: e.sum,
      };
    });

  const seasonal: SeasonalWeek[] = Array.from({ length: 53 }, (_, i) => {
    const week = i + 1;
    const list = [...(byWeek.get(week) ?? [])].sort((a, b) => a - b);
    return {
      week,
      median: list.length ? median(list) : null,
      min: list.length ? list[0] : null,
      max: list.length ? list[list.length - 1] : null,
      years: list.length,
    };
  });

  return {
    weekly: {
      series,
      recorded: weeklyObs.length,
      expected: series.length,
      first: weeklyObs[0]?.periodStart ?? null,
      last: weeklyObs[weeklyObs.length - 1]?.periodEnd ?? null,
      gaps,
      stats:
        maxObs && minObs
          ? {
              mean: values.reduce((a, b) => a + b, 0) / values.length,
              median: median(sorted),
              min: { value: minObs.value, periodStart: minObs.periodStart },
              max: { value: maxObs.value, periodStart: maxObs.periodStart },
            }
          : null,
      epiYears,
      seasonal,
      originsByYear: [...years.entries()]
        .sort(([a], [b]) => a - b)
        .map(([year, e]) => ({ year, origins: e.origins })),
    },
    yearly: toStream(observations.filter((o) => o.temporalResolution === "yearly")),
    monthly: toStream(observations.filter((o) => o.temporalResolution === "monthly")),
    caseDefinitions: [...new Set(observations.map((o) => o.caseDefinition))],
  };
}

/**
 * Stable, model-ready frame: one row per observation, ordered by disease,
 * geography, resolution and period. Future baseline/ML code consumes this,
 * never UI component state.
 */
export interface ObservationFrameRow {
  diseaseId: string;
  geographyId: string;
  geographicLevel: HealthObservation["geographicLevel"];
  temporalResolution: HealthObservation["temporalResolution"];
  periodStart: string;
  periodEnd: string;
  metric: HealthObservation["metric"];
  caseDefinition: HealthObservation["caseDefinition"];
  value: number;
  sourceRecordId: string | null;
}

export function toObservationFrame(observations: HealthObservation[]): ObservationFrameRow[] {
  return observations
    .map((o) => ({
      diseaseId: o.diseaseId,
      geographyId: o.geographyId,
      geographicLevel: o.geographicLevel,
      temporalResolution: o.temporalResolution,
      periodStart: o.periodStart,
      periodEnd: o.periodEnd,
      metric: o.metric,
      caseDefinition: o.caseDefinition,
      value: o.value,
      sourceRecordId: recordId(o),
    }))
    .sort(
      (a, b) =>
        a.diseaseId.localeCompare(b.diseaseId) ||
        a.geographyId.localeCompare(b.geographyId) ||
        a.temporalResolution.localeCompare(b.temporalResolution) ||
        a.periodStart.localeCompare(b.periodStart),
    );
}
