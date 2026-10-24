import type { SigmaData } from "./data";
import { epiWeek } from "@/lib/national-observations";

/**
 * Per reporting unit and epi year: reported cases over usable weeks, EARS alarm
 * weeks and DOH-threshold weeks. Small enough to send to the browser for all
 * 126 units (the full export is ~1.2 MB). Missing and suspect weeks are not
 * usable and add no cases.
 */
export interface UnitYear {
  year: number;
  cases: number;
  usableWeeks: number;
  weeks: number;
  earsWeeks: number;
  dohWeeks: number;
}

export function unitYearSummaries(data: SigmaData, years = [2016, 2017, 2018, 2019, 2020]): Record<string, UnitYear[]> {
  const { codes, weeks } = data.meta;
  const ok = codes.quality.indexOf("ok");
  const alarm = new Set(codes.ears.flatMap((c, i) => (c !== "none" && c !== "not computed" ? [i] : [])));
  const crossing = new Set([codes.doh.indexOf("alert"), codes.doh.indexOf("epidemic")]);
  // Epi (MMWR) years, as Lab and the DOH thresholds use them.
  const byYear = years.map((year) => weeks.flatMap((w, i) => (epiWeek(w).year === year ? [i] : [])));
  return Object.fromEntries(
    data.units.map((u) => [
      u.id,
      years.map((year, y) => {
        let cases = 0;
        let usableWeeks = 0;
        let earsWeeks = 0;
        let dohWeeks = 0;
        for (const i of byYear[y]) {
          if (u.quality[i] !== ok || u.value[i] === null) continue;
          usableWeeks++;
          cases += u.value[i]!;
          if (alarm.has(u.ears[i])) earsWeeks++;
          if (crossing.has(u.doh[i])) dohWeeks++;
        }
        return { year, cases, usableWeeks, weeks: byYear[y].length, earsWeeks, dohWeeks };
      }),
    ]),
  );
}
