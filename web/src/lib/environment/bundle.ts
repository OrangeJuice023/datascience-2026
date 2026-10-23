import type {
  GeographicLevel,
  HdxUnitRelation,
  IsoDate,
  WeatherComparability,
  WeatherQcFlag,
  WeatherSourceId,
  WeatherVariable,
} from "@/types/data";

/**
 * Columnar bundle written by ml/environment/export.py from
 * data/processed/environment/city_weekly_weather.csv
 * (web/src/data/environment-weekly.json). One series per geography × source,
 * one array slot per consecutive Sunday–Saturday week. Shared by the server
 * loader (load.ts) and the map, which imports the JSON lazily on the client.
 */
export interface EnvironmentBundle {
  generatedBy: string;
  weekConvention: string;
  variables: Record<WeatherVariable, string>;
  sources: Record<
    WeatherSourceId,
    {
      name: string;
      upstreamProduct: string;
      aggregationMethod: string;
      url: string;
      retrievedAt: string;
      license: string;
      attribution: string;
    }
  >;
  geographies: EnvironmentGeography[];
  comparability: Record<WeatherVariable, WeatherComparability>;
  series: EnvironmentSeries[];
}

export interface EnvironmentGeography {
  id: string;
  name: string;
  level: GeographicLevel;
  latitude: number;
  longitude: number;
  inCchain: boolean;
  psgcCode: string;
  hdxUnitId: string;
  hdxUnitRelation: HdxUnitRelation;
}

export interface EnvironmentSeries {
  geographyId: string;
  sourceId: WeatherSourceId;
  firstPeriodStart: IsoDate;
  coverageStart: IsoDate;
  coverageEnd: IsoDate;
  gridCell: string | null;
  values: Record<WeatherVariable, Array<number | null>>;
  daysObserved: number[];
  /** ";"-joined WeatherQcFlag values; "" = ok. */
  qcFlags: string[];
  /** H / M / L */
  confidence: string[];
}

export interface WeatherVariableMeta {
  label: string;
  unit: string;
  format: (value: number) => string;
}

export const WEATHER_VARIABLE_META: Record<WeatherVariable, WeatherVariableMeta> = {
  precipitation_mm: { label: "Rainfall", unit: "mm/week", format: (v) => `${v.toFixed(0)} mm` },
  temperature_mean_c: { label: "Mean temperature", unit: "°C", format: (v) => `${v.toFixed(1)} °C` },
  temperature_min_c: { label: "Minimum temperature", unit: "°C", format: (v) => `${v.toFixed(1)} °C` },
  temperature_max_c: { label: "Maximum temperature", unit: "°C", format: (v) => `${v.toFixed(1)} °C` },
  humidity_mean_pct: { label: "Relative humidity", unit: "%", format: (v) => `${v.toFixed(0)}%` },
};

export const WEATHER_SOURCE_LABEL: Record<WeatherSourceId, string> = {
  cchain: "CCHAIN",
  open_meteo: "Open-Meteo (ERA5)",
};

export const QC_FLAG_LABEL: Record<WeatherQcFlag, string> = {
  incomplete_week: "Incomplete week (fewer than 7 days)",
  range_check_failed: "Failed range check",
  rain_partial_area: "Rainfall covers part of the city only",
  provisional_era5t: "Provisional (ERA5T, revised after 2–3 months)",
};

export const COMPARABILITY_LABEL: Record<WeatherComparability, string> = {
  raw_interchangeable: "The two sources agree on raw values",
  anomaly_interchangeable: "The two sources agree on anomalies, not on raw levels",
  not_interchangeable: "The two sources disagree; never mix them in one series",
};

/** What each relation means for joining weather to HDX dengue counts. */
export const RELATION_LABEL: Record<HdxUnitRelation, string> = {
  same_area: "Same area as its HDX dengue reporting unit",
  inside_unit: "Part of a larger HDX reporting unit; weather is for the city only",
};

const DAY_MS = 86_400_000;

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Index of the week starting `periodStart` in `series`, or -1 outside it. */
export function weekIndex(series: EnvironmentSeries, periodStart: IsoDate): number {
  const i = Math.round((Date.parse(periodStart) - Date.parse(series.firstPeriodStart)) / (7 * DAY_MS));
  return i >= 0 && i < series.daysObserved.length ? i : -1;
}

export function qcFlagsAt(series: EnvironmentSeries, i: number): WeatherQcFlag[] {
  const joined = series.qcFlags[i];
  return joined ? (joined.split(";") as WeatherQcFlag[]) : [];
}

export function findSeries(
  bundle: EnvironmentBundle,
  geographyId: string,
  sourceId: WeatherSourceId,
): EnvironmentSeries | undefined {
  return bundle.series.find((s) => s.geographyId === geographyId && s.sourceId === sourceId);
}
