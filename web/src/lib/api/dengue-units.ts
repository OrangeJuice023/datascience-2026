import type { DengueUnitsData } from "@sigma/contracts";
import type { SigmaData } from "@/lib/sigma/data";
import { summarizeUnitYears } from "@/lib/sigma/lab";
import { unitYearSummaries } from "@/lib/sigma/unit-years";

/**
 * GET /api/v1/dengue/units: per reporting unit and epi year, reported cases
 * over usable weeks, EARS alarm weeks and DOH-threshold weeks, from the SIGMA
 * export (public/data/sigma/hdx-dengue-sigma.json). The counts come from
 * `unitYearSummaries`, the same figures the Policy page hands to SIGI; the
 * evaluated-week counts come from the Lab's `summarizeUnitYears`, so a year in
 * which nothing could be computed is reported as null, never as zero alarms.
 */

/** The epi years the export covers in full or in part (2021 has one week). */
export const DENGUE_UNIT_YEARS = [2016, 2017, 2018, 2019, 2020];

export function buildDengueUnits(data: SigmaData, input: { unitId?: string } = {}): DengueUnitsData {
  const selected = input.unitId ? data.units.filter((u) => u.id === input.unitId) : data.units;
  const counts = unitYearSummaries({ ...data, units: selected }, DENGUE_UNIT_YEARS);
  const { weeks, source, weekNote, assumptions, doh } = data.meta;

  return {
    units: selected.map((unit) => {
      const evaluated = new Map(summarizeUnitYears(data, unit).map((row) => [row.year, row]));
      return {
        id: unit.id,
        name: unit.name,
        unitType: unit.unitType,
        regionId: unit.regionId,
        years: (counts[unit.id] ?? []).map((y) => {
          const row = evaluated.get(y.year);
          const earsEvaluatedWeeks = row?.earsEvaluatedWeeks ?? 0;
          const dohEvaluatedWeeks = row?.dohEvaluatedWeeks ?? 0;
          return {
            year: y.year,
            cases: y.usableWeeks > 0 ? y.cases : null,
            usableWeeks: y.usableWeeks,
            weeks: y.weeks,
            earsWeeks: earsEvaluatedWeeks > 0 ? y.earsWeeks : null,
            earsEvaluatedWeeks,
            dohWeeks: dohEvaluatedWeeks > 0 ? y.dohWeeks : null,
            dohEvaluatedWeeks,
          };
        }),
      };
    }),
    scope: {
      source,
      period: { from: weeks[0], to: weeks[weeks.length - 1], weeks: weeks.length, epiYears: DENGUE_UNIT_YEARS },
      units: selected.length,
      notes: [
        "Historical weekly reports (2016-2021), not real-time data and not a forecast. Retrospective prototype output, not a validated public-health claim.",
        "A reporting unit is not always a whole province: a province remainder excludes the cities reported separately.",
        "Cases are summed over usable weeks only. Missing weeks and suspected cases/deaths swap weeks are no data, never zero, so a year with unusable weeks is not an annual total.",
        "EARS weeks count weeks with a C1, C2 or C3 alarm, and are null when no week of the year had enough baseline to compute EARS.",
        `DOH weeks count weeks above the DOH alert or epidemic threshold, and are null when no week could be compared. ${doh}`,
        weekNote.replace(/`/g, ""),
        ...assumptions,
      ],
    },
  };
}
