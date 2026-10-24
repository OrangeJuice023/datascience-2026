import { describe, expect, it } from 'vitest';

import { regionLabel, searchUnits, unitTypeLabel, yearCells } from './units';

const UNITS = [
  { id: 'quezon-city', name: 'Quezon City', unitType: 'city_huc', regionId: 'ncr' },
  { id: 'quezon', name: 'Quezon', unitType: 'province_remainder', regionId: 'calabarzon' },
  { id: 'iloilo-city', name: 'Iloilo City', unitType: 'city_huc', regionId: 'western-visayas' },
  { id: 'las-pinas', name: 'Las Piñas City', unitType: 'city_huc', regionId: 'ncr' },
  { id: 'rizal', name: 'Rizal', unitType: 'province_remainder', regionId: 'calabarzon' },
];

describe('unit labels', () => {
  it('names regions and unit types in plain words', () => {
    expect(regionLabel('ncr')).toBe('NCR');
    expect(regionLabel('western-visayas')).toBe('Western Visayas');
    expect(regionLabel('davao-region')).toBe('Davao Region');
    expect(unitTypeLabel('province_remainder')).toBe('Province, excluding separately reported cities');
    expect(unitTypeLabel('something_new')).toBe('something_new');
  });
});

describe('searchUnits', () => {
  it('lists every unit A–Z for an empty query', () => {
    expect(searchUnits(UNITS, '  ').map((u) => u.id)).toEqual([
      'iloilo-city',
      'las-pinas',
      'quezon',
      'quezon-city',
      'rizal',
    ]);
  });

  it('puts names that start with the query first', () => {
    expect(searchUnits(UNITS, 'quezon').map((u) => u.id)).toEqual(['quezon', 'quezon-city']);
    expect(searchUnits(UNITS, 'city').map((u) => u.id)).toEqual(['iloilo-city', 'las-pinas', 'quezon-city']);
  });

  it('matches region and type, ignoring case and accents, and needs every word', () => {
    expect(searchUnits(UNITS, 'calabarzon').map((u) => u.id)).toEqual(['quezon', 'rizal']);
    expect(searchUnits(UNITS, 'las pinas').map((u) => u.id)).toEqual(['las-pinas']);
    expect(searchUnits(UNITS, 'NCR quezon').map((u) => u.id)).toEqual(['quezon-city']);
    expect(searchUnits(UNITS, 'atlantis')).toEqual([]);
  });
});

describe('yearCells', () => {
  it('shows counts with what they were counted over', () => {
    const cells = yearCells({
      year: 2019,
      cases: 11174,
      usableWeeks: 51,
      weeks: 52,
      earsWeeks: 19,
      earsEvaluatedWeeks: 51,
      dohWeeks: 20,
      dohEvaluatedWeeks: 51,
    });
    expect(cells).toMatchObject({
      cases: '11,174',
      casesDetail: '51 of 52 weeks usable',
      ears: '19',
      earsDetail: 'of 51 weeks evaluated',
      doh: '20',
      dohDetail: 'of 51 weeks compared',
    });
    expect(cells.accessibilityLabel).toContain('11,174 reported cases over 51 of 52 usable weeks');
  });

  it('keeps a real zero as zero', () => {
    const cells = yearCells({
      year: 2020,
      cases: 1720,
      usableWeeks: 47,
      weeks: 53,
      earsWeeks: 0,
      earsEvaluatedWeeks: 42,
      dohWeeks: 0,
      dohEvaluatedWeeks: 47,
    });
    expect(cells.ears).toBe('0');
    expect(cells.doh).toBe('0');
  });

  it('never shows missing data as zero', () => {
    const noData = yearCells({
      year: 2016,
      cases: null,
      usableWeeks: 0,
      weeks: 51,
      earsWeeks: null,
      earsEvaluatedWeeks: 0,
      dohWeeks: null,
      dohEvaluatedWeeks: 0,
    });
    expect(noData.cases).toBe('No data');
    expect(noData.ears).toBe('Not computed');
    expect(noData.doh).toBe('No threshold');
    expect(noData.dohDetail).toBe('no usable week');
    expect(noData.accessibilityLabel).not.toMatch(/\b0 reported cases\b/);

    const beforeThresholds = yearCells({
      year: 2017,
      cases: 9655,
      usableWeeks: 52,
      weeks: 52,
      earsWeeks: 14,
      earsEvaluatedWeeks: 52,
      dohWeeks: null,
      dohEvaluatedWeeks: 0,
    });
    expect(beforeThresholds.doh).toBe('No threshold');
    expect(beforeThresholds.dohDetail).toBe('needs 3 prior years');
  });
});
