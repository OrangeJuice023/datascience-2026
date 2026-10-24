import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SigmaData } from "./data";

/**
 * Coverage figures for the Overview, counted from the committed SIGMA export
 * (web/public/data/sigma/hdx-dengue-sigma.json) rather than typed in, so the
 * page can never disagree with the data.
 */
export interface SigmaSummary {
  units: number;
  firstWeek: string;
  lastWeek: string;
  weeks: number;
  /** Weeks in which no reporting unit has a usable value (e.g. 2019-01-06). */
  emptyWeeks: number;
  /** Unit-weeks with a usable ("ok") value. */
  usableUnitWeeks: number;
  /** Unit-weeks with an EARS alarm (C1, C2 or C3). */
  earsAlarmUnitWeeks: number;
  /** Unit-weeks above the DOH alert or epidemic threshold. */
  dohCrossingUnitWeeks: number;
  /** The week with the most units alarmed, and how many. */
  peak: { week: string; units: number };
  meta: Pick<SigmaData["meta"], "source" | "doh" | "ears" | "weekNote" | "assumptions">;
}

const FILE = join(process.cwd(), "public", "data", "sigma", "hdx-dengue-sigma.json");

let cached: Promise<SigmaData | null> | null = null;

/** The committed SIGMA export, read once per server instance; null if it cannot be read. */
export function readSigmaData(): Promise<SigmaData | null> {
  cached ??= readFile(FILE, "utf8")
    .then((text) => JSON.parse(text) as SigmaData)
    .catch(() => {
      cached = null; // try again on the next request
      return null;
    });
  return cached;
}

export async function loadSigmaSummary(): Promise<SigmaSummary | null> {
  const data = await readSigmaData();
  if (!data) return null;
  const { meta, units } = data;
  const ok = meta.codes.quality.indexOf("ok");
  const alarmCodes = new Set(
    meta.codes.ears.flatMap((code, i) => (code !== "none" && code !== "not computed" ? [i] : [])),
  );
  const crossingCodes = new Set([meta.codes.doh.indexOf("alert"), meta.codes.doh.indexOf("epidemic")]);

  let usable = 0;
  let alarms = 0;
  let crossings = 0;
  const alarmedPerWeek = new Array<number>(meta.weeks.length).fill(0);
  const usablePerWeek = new Array<number>(meta.weeks.length).fill(0);
  for (const unit of units) {
    unit.quality.forEach((q, w) => {
      if (q !== ok) return;
      usable++;
      usablePerWeek[w]++;
      if (alarmCodes.has(unit.ears[w] ?? -1)) {
        alarms++;
        alarmedPerWeek[w]++;
      }
      if (crossingCodes.has(unit.doh[w] ?? -1)) crossings++;
    });
  }
  const peakIndex = alarmedPerWeek.indexOf(Math.max(...alarmedPerWeek));

  return {
    units: units.length,
    firstWeek: meta.weeks[0],
    lastWeek: meta.weeks[meta.weeks.length - 1],
    weeks: meta.weeks.length,
    emptyWeeks: usablePerWeek.filter((n) => n === 0).length,
    usableUnitWeeks: usable,
    earsAlarmUnitWeeks: alarms,
    dohCrossingUnitWeeks: crossings,
    peak: { week: meta.weeks[peakIndex], units: alarmedPerWeek[peakIndex] },
    meta: {
      source: meta.source,
      doh: meta.doh,
      ears: meta.ears,
      weekNote: meta.weekNote,
      assumptions: meta.assumptions,
    },
  };
}
