import { describe, expect, it } from 'vitest';

import opendengue from '../../../web/src/data/opendengue-ph.json';
import { binSeries, peakBin, type BinInput } from './bar-bins';

/**
 * The Full series chart must cover every week. The earlier chart kept the
 * first 24 and last 36 bars of 569 weeks, dropped the 2019 epidemic in
 * between, and reported a peak of 3,591 instead of 21,743.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The national weekly series on a full weekly grid; a week with no row is null, as the API sends it. */
function nationalWeekly(): BinInput[] {
  const rows = (opendengue as { rows: { resolution: string; periodStart: string; value: number }[] }).rows
    .filter((r) => r.resolution === 'weekly')
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const byStart = new Map(rows.map((r) => [r.periodStart, r.value]));
  const out: BinInput[] = [];
  const end = Date.parse(rows[rows.length - 1].periodStart);
  for (let t = Date.parse(rows[0].periodStart); t <= end; t += 7 * DAY_MS) {
    const label = new Date(t).toISOString().slice(0, 10);
    out.push({ label, value: byStart.get(label) ?? null });
  }
  return out;
}

describe('binSeries', () => {
  it('keeps every week of the national series', () => {
    const series = nationalWeekly();
    const { bins, totalWeeks, weeksPerBar } = binSeries(series, 60);
    expect(totalWeeks).toBe(series.length);
    expect(bins.reduce((sum, b) => sum + b.weeks, 0)).toBe(series.length);
    expect(bins.length).toBeLessThanOrEqual(60);
    expect(weeksPerBar).toBeGreaterThan(1);
    expect(bins[0].label).toBe(series[0].label);
    expect(bins[bins.length - 1].endLabel).toBe(series[series.length - 1].label);
  });

  it('preserves the 2019 epidemic peak and names its week', () => {
    const peak = peakBin(binSeries(nationalWeekly(), 60).bins);
    expect(peak?.value).toBe(21743);
    expect(peak?.peakLabel).toBe('2019-07-28');
  });

  it('labels bars with full dates so the year is visible', () => {
    const { bins } = binSeries(nationalWeekly(), 60);
    for (const bin of bins) expect(bin.label).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const years = new Set(bins.map((b) => b.label.slice(0, 4)));
    expect(years.has('2019')).toBe(true);
  });

  it('keeps a span with no recorded week as a gap, not zero', () => {
    const { bins } = binSeries(
      [
        { label: '2020-01-05', value: null },
        { label: '2020-01-12', value: null },
        { label: '2020-01-19', value: 0 },
        { label: '2020-01-26', value: null },
      ],
      2
    );
    expect(bins[0]).toMatchObject({ value: null, peakLabel: null, recordedWeeks: 0 });
    expect(bins[1]).toMatchObject({ value: 0, peakLabel: '2020-01-19', recordedWeeks: 1 });
  });

  it('draws one bar per week when the series fits', () => {
    const data = [
      { label: '2020-01-05', value: 3 },
      { label: '2020-01-12', value: 5, highlight: true },
    ];
    const { bins, weeksPerBar } = binSeries(data, 60);
    expect(weeksPerBar).toBe(1);
    expect(bins.map((b) => b.value)).toEqual([3, 5]);
    expect(bins[1].highlight).toBe(true);
  });

  it('reports no peak when nothing was recorded', () => {
    expect(peakBin(binSeries([{ label: '2020-01-05', value: null }], 60).bins)).toBeNull();
  });
});
