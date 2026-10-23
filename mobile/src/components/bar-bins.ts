/**
 * Fits a long weekly series into a fixed number of bars without dropping
 * any week.
 *
 * Consecutive weeks are grouped into equal spans. Each bar shows the highest
 * recorded week in its span, so a peak (the 2019 epidemic, for example) is
 * never averaged away. A span with no recorded week stays null: it is a gap,
 * not zero. Plain TypeScript so it can be tested without React Native.
 */

export interface BinInput {
  /** ISO date of the period start (YYYY-MM-DD). */
  label: string;
  value: number | null;
  highlight?: boolean;
}

export interface Bin {
  /** First week in the span. */
  label: string;
  /** Last week in the span. */
  endLabel: string;
  /** Highest recorded value in the span, or null when no week was recorded. */
  value: number | null;
  /** The week that holds `value`, or null. */
  peakLabel: string | null;
  /** Weeks in the span, and how many of them have a record. */
  weeks: number;
  recordedWeeks: number;
  highlight: boolean;
}

export interface Binned {
  bins: Bin[];
  /** Weeks per bar; 1 means every week is its own bar. */
  weeksPerBar: number;
  /** Total input weeks; always equals the sum of `bins[].weeks`. */
  totalWeeks: number;
}

export function binSeries(data: BinInput[], maxBars: number): Binned {
  const weeksPerBar = data.length <= maxBars ? 1 : Math.ceil(data.length / Math.max(1, maxBars));
  const bins: Bin[] = [];
  for (let start = 0; start < data.length; start += weeksPerBar) {
    const span = data.slice(start, start + weeksPerBar);
    let peak: BinInput | null = null;
    for (const datum of span) {
      if (datum.value === null) continue;
      if (peak === null || datum.value > (peak.value as number)) peak = datum;
    }
    bins.push({
      label: span[0].label,
      endLabel: span[span.length - 1].label,
      value: peak ? peak.value : null,
      peakLabel: peak ? peak.label : null,
      weeks: span.length,
      recordedWeeks: span.filter((d) => d.value !== null).length,
      highlight: span.some((d) => d.highlight),
    });
  }
  return { bins, weeksPerBar, totalWeeks: data.length };
}

/** The bar holding the series maximum, or null when nothing was recorded. */
export function peakBin(bins: Bin[]): Bin | null {
  let best: Bin | null = null;
  for (const bin of bins) {
    if (bin.value === null) continue;
    if (best === null || bin.value > (best.value as number)) best = bin;
  }
  return best;
}
