import type { DengueSignalRecord } from "@sigma/contracts";
import { hasData, weekOf, type SigmaData } from "@/lib/sigma/data";

/**
 * EARS results served by GET /api/v1/dengue/signals, read from the committed
 * SIGMA export (public/data/sigma/hdx-dengue-sigma.json, ml/export_sigma_web.py).
 *
 * One record per reporting unit, week and EARS method (C1, C2, C3) whose
 * statistic was computed on a usable week. A missing or suspect-swap week, or
 * a method that could not be computed, produces no record: absence is "no
 * result", never a zero or a "no signal".
 */

const METHODS = [
  { key: "c1", name: "EARS C1" },
  { key: "c2", name: "EARS C2" },
  { key: "c3", name: "EARS C3" },
] as const;

export interface EarsSelection {
  /** Reporting unit id; omitted means every unit. */
  unitId?: string;
  /** Week start (ISO date in `meta.weeks`); omitted means the latest week with an EARS result, or the whole series for one unit. */
  week?: string;
}

export interface EarsSignals {
  records: DengueSignalRecord[];
  /** Weeks the records cover. */
  weeks: string[];
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Index of the latest week in which at least one unit has a computed EARS statistic. */
export function latestEarsWeek(data: SigmaData): number {
  for (let w = data.meta.weeks.length - 1; w >= 0; w--) {
    if (data.units.some((u) => hasData(weekOf(data, u, w)) && u.c1[w] !== null)) return w;
  }
  return -1;
}

export function earsSignals(data: SigmaData, selection: EarsSelection = {}): EarsSignals {
  const { weeks, ears } = data.meta;
  const units = selection.unitId ? data.units.filter((u) => u.id === selection.unitId) : data.units;
  let indices: number[];
  if (selection.week !== undefined) {
    const w = weeks.indexOf(selection.week);
    indices = w >= 0 ? [w] : [];
  } else if (selection.unitId) {
    indices = weeks.map((_, i) => i);
  } else {
    const w = latestEarsWeek(data);
    indices = w >= 0 ? [w] : [];
  }

  const records: DengueSignalRecord[] = [];
  for (const unit of units) {
    for (const w of indices) {
      const week = weekOf(data, unit, w);
      if (!hasData(week)) continue;
      for (const m of METHODS) {
        const value = week[m.key];
        if (value === null) continue;
        const threshold = m.key === "c3" ? ears.c3Threshold : ears.c1c2Threshold;
        records.push({
          id: `${unit.id}:${week.week}:${m.key}`,
          geographyId: unit.id,
          periodStart: week.week,
          periodEnd: addDays(week.week, 6),
          method: m.name,
          value,
          threshold,
          // The export's label already applies the minimum-count rule, so use it rather than value > threshold.
          alarm: week.ears.split("+").includes(m.key.toUpperCase()),
        });
      }
    }
  }
  return { records, weeks: indices.map((i) => weeks[i]) };
}
