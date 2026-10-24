import { describe, expect, it } from 'vitest';

import { formatCount, formatIsoDate, formatPeso, historicalStatusLabel, shareLabel, weeksLabel } from './format';

describe('shareLabel', () => {
  it('formats a real share', () => {
    expect(shareLabel(3, 4, 'none')).toBe('75%');
    expect(shareLabel(0, 4, 'none')).toBe('0%');
  });

  it('never shows 0 of 0 as 0%', () => {
    expect(shareLabel(0, 0, 'Nothing to measure')).toBe('Nothing to measure');
  });
});

describe('number and date formatting', () => {
  it('groups thousands without a locale lookup', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(11174)).toBe('11,174');
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatCount(36.33)).toBe('36.33');
  });

  it('formats pesos to the centavo', () => {
    expect(formatPeso(0.5)).toBe('₱0.50');
    expect(formatPeso(2.25)).toBe('₱2.25');
    expect(formatPeso(1250)).toBe('₱1,250.00');
  });

  it('formats ISO dates and leaves anything else alone', () => {
    expect(formatIsoDate('2016-01-10')).toBe('10 Jan 2016');
    expect(formatIsoDate('2023-11-25')).toBe('25 Nov 2023');
    expect(formatIsoDate(null)).toBe('—');
    expect(formatIsoDate('unknown')).toBe('unknown');
  });

  it('pluralises weeks', () => {
    expect(weeksLabel(1)).toBe('1 week');
    expect(weeksLabel(25)).toBe('25 weeks');
  });

  it('shows a connected series as historical, never as current', () => {
    expect(historicalStatusLabel('live')).toBe('Historical data');
    expect(historicalStatusLabel('not_connected')).toBeUndefined();
    expect(historicalStatusLabel(null)).toBeUndefined();
  });
});
