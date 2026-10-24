import type { DengueUnitRecord, DengueUnitYear } from '@sigma/contracts';

import { formatCount } from './format';

/**
 * Reporting-unit labels, search and the per-epi-year cells. Plain TypeScript,
 * so it is tested without React Native.
 *
 * The cells keep "no data" apart from zero: a year with no usable week, a
 * year EARS could not be computed for, and a year before the DOH thresholds
 * exist each say so in words instead of showing 0.
 */

/** Opens on the same unit as the web Policy page. */
export const DEFAULT_UNIT_ID = 'quezon-city';

/** Same wording as the web Lab (web/src/lib/sigma/lab.ts). */
export const UNIT_TYPE_LABEL: Record<string, string> = {
  province_full: 'Province',
  province_remainder: 'Province, excluding separately reported cities',
  city_huc: 'Highly urbanized city',
  city_icc: 'Independent component city',
  city_cc: 'Component city (reported separately)',
  municipality: 'Municipality',
};

const REGION_ACRONYMS: Record<string, string> = {
  ncr: 'NCR',
  car: 'CAR',
  barmm: 'BARMM',
  caraga: 'Caraga',
  calabarzon: 'CALABARZON',
  mimaropa: 'MIMAROPA',
  soccsksargen: 'SOCCSKSARGEN',
};

export function unitTypeLabel(unitType: string): string {
  return UNIT_TYPE_LABEL[unitType] ?? unitType;
}

/** "western-visayas" → "Western Visayas", "ncr" → "NCR". */
export function regionLabel(regionId: string): string {
  const known = REGION_ACRONYMS[regionId];
  if (known) return known;
  return regionId
    .split('-')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Units matching a search, by name, region or unit type. Every word of the
 * query has to match; names that start with the query come first, then A–Z.
 */
export function searchUnits<T extends Pick<DengueUnitRecord, 'id' | 'name' | 'unitType' | 'regionId'>>(
  units: T[],
  query: string
): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  if (words.length === 0) return [...units].sort(byName);
  const q = words.join(' ');
  return units
    .filter((unit) => {
      const haystack = fold(`${unit.name} ${regionLabel(unit.regionId)} ${unitTypeLabel(unit.unitType)}`);
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => {
      const aStarts = fold(a.name).startsWith(q) ? 0 : 1;
      const bStarts = fold(b.name).startsWith(q) ? 0 : 1;
      return aStarts - bStarts || byName(a, b);
    });
}

export interface YearCells {
  cases: string;
  /** Usable weeks of the weeks in the export, e.g. "45 of 51 weeks usable". */
  casesDetail: string;
  ears: string;
  earsDetail: string;
  doh: string;
  dohDetail: string;
  /** The whole row as one sentence, for a screen reader. */
  accessibilityLabel: string;
}

export function yearCells(year: DengueUnitYear): YearCells {
  const usable = `${year.usableWeeks} of ${year.weeks} weeks usable`;
  const cases = year.cases === null ? 'No data' : formatCount(year.cases);
  const casesDetail = year.cases === null ? `0 of ${year.weeks} weeks usable` : usable;

  const ears = year.earsWeeks === null ? 'Not computed' : `${year.earsWeeks}`;
  const earsDetail =
    year.earsWeeks === null ? 'too little baseline' : `of ${year.earsEvaluatedWeeks} weeks evaluated`;

  const doh = year.dohWeeks === null ? 'No threshold' : `${year.dohWeeks}`;
  const dohDetail =
    year.dohWeeks === null
      ? year.usableWeeks === 0
        ? 'no usable week'
        : 'needs 3 prior years'
      : `of ${year.dohEvaluatedWeeks} weeks compared`;

  const spokenCases =
    year.cases === null
      ? `no usable week of ${year.weeks}`
      : `${cases} reported cases over ${year.usableWeeks} of ${year.weeks} usable weeks`;
  const spokenEars =
    year.earsWeeks === null
      ? 'EARS not computed'
      : `EARS alarm in ${year.earsWeeks} of ${year.earsEvaluatedWeeks} evaluated weeks`;
  const spokenDoh =
    year.dohWeeks === null
      ? 'no DOH threshold to compare with'
      : `above a DOH threshold in ${year.dohWeeks} of ${year.dohEvaluatedWeeks} compared weeks`;

  return {
    cases,
    casesDetail,
    ears,
    earsDetail,
    doh,
    dohDetail,
    accessibilityLabel: `Epi year ${year.year}: ${spokenCases}; ${spokenEars}; ${spokenDoh}.`,
  };
}
