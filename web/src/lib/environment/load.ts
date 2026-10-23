import "server-only";

import type {
  ConfidenceLevel,
  EnvironmentalObservation,
  IsoDate,
  WeatherCoverage,
  WeatherQcFlag,
  WeatherSourceId,
  WeatherVariable,
} from "@/types/data";
import type { EnvironmentQuery } from "@/data/provider";
import { addDays, type EnvironmentBundle } from "./bundle";
import bundle from "@/data/environment-weekly.json";

const BUNDLE = bundle as unknown as EnvironmentBundle;

export const WEATHER_VARIABLES = Object.keys(BUNDLE.variables) as WeatherVariable[];

/** Source registry ids (data/sample/reference.ts) for each weather source. */
const REGISTRY_ID: Record<WeatherSourceId, string> = {
  cchain: "project-cchain",
  open_meteo: "open-meteo",
};

const CONFIDENCE: Record<string, ConfidenceLevel> = { H: "high", M: "medium", L: "low" };
const DAY_MS = 86_400_000;

/** MMWR epi year/week: the year of the week's Wednesday. */
function epiWeek(periodStart: IsoDate): { epiYear: number; epiWeek: number } {
  const wed = new Date(Date.parse(`${addDays(periodStart, 3)}T00:00:00Z`));
  const year = wed.getUTCFullYear();
  const dayOfYear = Math.floor((wed.getTime() - Date.UTC(year, 0, 1)) / DAY_MS);
  return { epiYear: year, epiWeek: Math.floor(dayOfYear / 7) + 1 };
}

const LEVEL_BY_ID = new Map(BUNDLE.geographies.map((g) => [g.id, g.level]));

function expand(series: EnvironmentBundle["series"][number]): EnvironmentalObservation[] {
  const source = BUNDLE.sources[series.sourceId];
  return series.daysObserved.map((daysObserved, i): EnvironmentalObservation => {
    const periodStart = addDays(series.firstPeriodStart, 7 * i);
    const values = Object.fromEntries(
      WEATHER_VARIABLES.map((v) => [v, series.values[v][i]]),
    ) as Record<WeatherVariable, number | null>;
    return {
      id: `${series.geographyId}:${series.sourceId}:${periodStart}`,
      geographyId: series.geographyId,
      geographicLevel: LEVEL_BY_ID.get(series.geographyId) ?? "municipal",
      periodStart,
      periodEnd: addDays(periodStart, 6),
      ...epiWeek(periodStart),
      temporalResolution: "weekly",
      sourceId: series.sourceId,
      values,
      daysObserved,
      qcFlags: series.qcFlags[i] ? (series.qcFlags[i].split(";") as WeatherQcFlag[]) : [],
      confidence: CONFIDENCE[series.confidence[i]] ?? "low",
      provenance: {
        sourceIds: [REGISTRY_ID[series.sourceId]],
        method: "ingested",
        pipeline: BUNDLE.generatedBy,
        upstreamUrl: source.url,
        upstreamVersion: source.upstreamProduct,
        retrievedAt: source.retrievedAt,
        recordedAt: source.retrievedAt,
        isSample: false,
      },
    };
  });
}

export function getEnvironmentalObservations(
  geographyId: string,
  query: EnvironmentQuery = {},
): EnvironmentalObservation[] {
  return BUNDLE.series
    .filter((s) => s.geographyId === geographyId && (!query.sourceId || s.sourceId === query.sourceId))
    .flatMap(expand)
    .filter(
      (o) => (!query.from || o.periodStart >= query.from) && (!query.to || o.periodStart <= query.to),
    );
}

export function getWeatherCoverage(): WeatherCoverage[] {
  const geo = new Map(BUNDLE.geographies.map((g) => [g.id, g]));
  return BUNDLE.series.map((s): WeatherCoverage => {
    const g = geo.get(s.geographyId);
    const qcFlagCounts: Partial<Record<WeatherQcFlag, number>> = {};
    for (const joined of s.qcFlags) {
      for (const flag of joined ? (joined.split(";") as WeatherQcFlag[]) : []) {
        qcFlagCounts[flag] = (qcFlagCounts[flag] ?? 0) + 1;
      }
    }
    return {
      geographyId: s.geographyId,
      geographyName: g?.name ?? s.geographyId,
      centroid: { latitude: g?.latitude ?? NaN, longitude: g?.longitude ?? NaN },
      inCchain: g?.inCchain ?? false,
      psgcCode: g?.psgcCode ?? "",
      hdxUnitId: g?.hdxUnitId ?? "",
      hdxUnitRelation: g?.hdxUnitRelation ?? "inside_unit",
      sourceId: s.sourceId,
      upstreamProduct: BUNDLE.sources[s.sourceId].upstreamProduct,
      aggregationMethod: BUNDLE.sources[s.sourceId].aggregationMethod,
      coverageStart: s.coverageStart,
      coverageEnd: s.coverageEnd,
      weeks: s.daysObserved.length,
      completeWeeks: s.daysObserved.filter((d) => d === 7).length,
      qcFlagCounts,
      comparability: BUNDLE.comparability,
    };
  });
}
