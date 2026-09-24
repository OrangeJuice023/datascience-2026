import type { HealthObservation } from "@/types/data";

export interface NationalWeek {
  periodStart: string;
  value: number;
}

export interface NationalYear {
  year: number;
  /** Null where the source has no annual record; never interpolated. */
  value: number | null;
}

export interface NationalSummary {
  weeklyByYear: Array<{ year: number; weeks: NationalWeek[] }>;
  annual: NationalYear[];
  monthlyYears: number[];
  missingAnnualYears: number[];
  source: { name: string; version: string; license: string; url: string };
}

/**
 * Shapes OpenDengue national records for display, keeping each temporal
 * resolution separate: weekly, monthly and annual rows are different
 * reporting streams and are never summed into one another.
 */
export function summarizeNational(observations: HealthObservation[]): NationalSummary {
  const weekly = observations.filter((o) => o.temporalResolution === "weekly");
  const yearly = observations.filter((o) => o.temporalResolution === "yearly");
  const monthly = observations.filter((o) => o.temporalResolution === "monthly");

  const byYear = new Map<number, NationalWeek[]>();
  for (const o of weekly) {
    // Grouped by start date: the record's final 2013 week ends in 2014, and
    // an end-date rule would invent a one-week "2014" series.
    const year = Number(o.periodStart.slice(0, 4));
    const list = byYear.get(year) ?? [];
    list.push({ periodStart: o.periodStart, value: o.value });
    byYear.set(year, list);
  }

  const annualByYear = new Map(yearly.map((o) => [Number(o.periodStart.slice(0, 4)), o.value]));
  const years = [...annualByYear.keys()];
  const first = Math.min(...years);
  const last = Math.max(...years);
  const annual: NationalYear[] = [];
  const missingAnnualYears: number[] = [];
  for (let year = first; year <= last; year++) {
    const value = annualByYear.get(year) ?? null;
    if (value === null) missingAnnualYears.push(year);
    annual.push({ year, value });
  }

  return {
    weeklyByYear: [...byYear.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, weeks]) => ({ year, weeks })),
    annual,
    monthlyYears: [...new Set(monthly.map((o) => Number(o.periodStart.slice(0, 4))))],
    missingAnnualYears,
    source: {
      name: "OpenDengue",
      version: "1.3",
      license: "CC BY 4.0",
      url: "https://opendengue.org/",
    },
  };
}
