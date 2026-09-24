import type { TrendPoint } from "@/types";
import { seededNoise } from "@/lib/utils";

/**
 * DEMO DATA — generates an illustrative observed-vs-baseline series.
 * Deterministic (no Math.random / Date.now) so server and client renders
 * match exactly. Not derived from any real surveillance dataset.
 */
export function generateDemoTrend(
  weeks: number,
  seed: number,
  options?: { rampWeeks?: number; rampStrength?: number },
): TrendPoint[] {
  const rampWeeks = options?.rampWeeks ?? 8;
  const rampStrength = options?.rampStrength ?? 1.1;
  const start = new Date("2026-01-05T00:00:00Z");

  return Array.from({ length: weeks }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i * 7);

    const seasonal = 10 + 3 * Math.sin((i / weeks) * Math.PI * 2 + seed);
    const noise = (seededNoise(i, seed) - 0.5) * 2.5;
    const expected = Math.max(2, seasonal);

    const rampProgress = Math.max(0, i - (weeks - rampWeeks)) / rampWeeks;
    const ramp = rampProgress > 0 ? rampProgress * rampProgress * rampStrength * expected : 0;

    const observed = Math.max(0, expected + noise + ramp);
    const bandWidth = expected * 0.25 + 1.5;

    return {
      date: date.toISOString().slice(0, 10),
      observed: Math.round(observed * 10) / 10,
      expected: Math.round(expected * 10) / 10,
      lowerBound: Math.round(Math.max(0, expected - bandWidth) * 10) / 10,
      upperBound: Math.round((expected + bandWidth) * 10) / 10,
    };
  });
}

export const DEMO_TREND_SERIES: Record<string, TrendPoint[]> = {
  "quezon-city": generateDemoTrend(37, 1),
  manila: generateDemoTrend(37, 2, { rampStrength: 0.7 }),
  pasig: generateDemoTrend(37, 3, { rampStrength: 1.3 }),
  caloocan: generateDemoTrend(37, 4, { rampStrength: 0.8 }),
  taguig: generateDemoTrend(37, 5, { rampStrength: 0.9 }),
  antipolo: generateDemoTrend(37, 6, { rampStrength: 1.5 }),
  makati: generateDemoTrend(37, 7, { rampWeeks: 0, rampStrength: 0 }),
  // Areas whose demo signals are all "normal": flat or near-flat series, so
  // no LGU has to borrow another LGU's curve.
  mandaluyong: generateDemoTrend(37, 8, { rampWeeks: 0, rampStrength: 0 }),
  marikina: generateDemoTrend(37, 9, { rampStrength: 0.15 }),
  pasay: generateDemoTrend(37, 10, { rampWeeks: 0, rampStrength: 0 }),
  paranaque: generateDemoTrend(37, 11, { rampWeeks: 0, rampStrength: 0 }),
  "san-juan": generateDemoTrend(37, 12, { rampStrength: 0.1 }),
};

export function getTrendSeries(locationId: string): TrendPoint[] {
  return DEMO_TREND_SERIES[locationId] ?? DEMO_TREND_SERIES["quezon-city"];
}

export function latestAnomalyScore(series: TrendPoint[]): number {
  const last = series[series.length - 1];
  const spread = (last.upperBound - last.lowerBound) / 2 || 1;
  return Math.round(((last.observed - last.expected) / spread) * 100) / 100;
}
