import type { TrendPoint } from "@/types";

export interface HistogramBucket {
  bucket: string;
  count: number;
  isCurrent: boolean;
}

const EDGES = [1.0, 1.5, 2.0, 2.5];
const LABELS = ["<1.0x", "1.0–1.5x", "1.5–2.0x", "2.0–2.5x", "2.5x+"];

function bucketIndex(ratio: number): number {
  for (let i = 0; i < EDGES.length; i++) {
    if (ratio < EDGES[i]) return i;
  }
  return EDGES.length;
}

/** Builds a DEMO distribution of observed/expected ratios to contextualize the current signal. */
export function buildRatioHistogram(series: TrendPoint[]): {
  buckets: HistogramBucket[];
  currentRatio: number;
} {
  const historical = series.slice(0, -4);
  const counts = new Array(LABELS.length).fill(0);

  for (const point of historical) {
    counts[bucketIndex(point.observed / point.expected)] += 1;
  }

  const current = series[series.length - 1];
  const currentRatio = Math.round((current.observed / current.expected) * 100) / 100;
  const currentBucket = bucketIndex(currentRatio);

  const buckets: HistogramBucket[] = LABELS.map((label, i) => ({
    bucket: label,
    count: counts[i],
    isCurrent: i === currentBucket,
  }));

  return { buckets, currentRatio };
}

export function consecutiveElevatedPeriods(series: TrendPoint[], threshold = 1.25): number {
  let count = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].observed / series[i].expected >= threshold) count++;
    else break;
  }
  return count;
}

export function anomalyLabel(score: number): string {
  if (score >= 2) return "Elevated from historical baseline";
  if (score >= 1) return "Above expected range";
  if (score <= -1) return "Below expected range";
  return "Within historical range";
}

