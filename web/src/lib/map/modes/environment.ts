import {
  QC_FLAG_LABEL,
  RELATION_LABEL,
  WEATHER_SOURCE_LABEL,
  WEATHER_VARIABLE_META,
  addDays,
  qcFlagsAt,
  type EnvironmentBundle,
  type EnvironmentSeries,
} from "@/lib/environment/bundle";
import type { WeatherSourceId, WeatherVariable } from "@/types/data";
import { ENVIRONMENT_RAMP, ENVIRONMENT_NO_DATA_HEX, hexToRgba } from "../palette";
import type { DetailRow, MapDataBundle, MapFeature, MapFilters, MapModeDefinition, PreparedMode, Rgba } from "../types";

/** Required wording wherever weather is drawn next to dengue results. */
export const ENVIRONMENT_NOTE =
  "Context only: weather is shown beside the dengue signals, not as a cause of them. Compare cities within one source.";

// One formatter each: ~1,000 weeks per source, and toLocaleDateString builds a new formatter per call.
const WEEK_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

const EMPTY: PreparedMode = {
  timeline: { slices: [], trackLabel: "", interpretation: "", formatValue: String },
  legend: { title: "Environment", metric: "Loading weekly city weather…", classification: "none" },
  frameAt: () => ({ features: [], links: [] }),
};

/** The shared week calendar of one source's series, first Sunday to last. */
export function sourceWeeks(series: EnvironmentSeries[]): string[] {
  if (series.length === 0) return [];
  const first = series.map((s) => s.firstPeriodStart).sort()[0];
  const last = series.map((s) => addDays(s.firstPeriodStart, 7 * (s.daysObserved.length - 1))).sort().at(-1)!;
  const weeks: string[] = [];
  for (let w = first; w <= last; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

/** 2nd–98th percentile of every value of this source, so one storm week does not wash out the ramp. */
export function rampDomain(series: EnvironmentSeries[], variable: WeatherVariable): [number, number] {
  const values = series.flatMap((s) => s.values[variable].filter((v): v is number => v !== null)).sort((a, b) => a - b);
  if (values.length === 0) return [0, 1];
  const at = (q: number) => values[Math.min(values.length - 1, Math.floor(q * values.length))];
  const [lo, hi] = [at(0.02), at(0.98)];
  return hi > lo ? [lo, hi] : [lo, lo + 1];
}

/** Continuous one-hue ramp, light (low) → dark (high), clamped to the domain. */
export function rampColor(value: number, [lo, hi]: [number, number]): Rgba {
  const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo))) * (ENVIRONMENT_RAMP.length - 1);
  const i = Math.min(ENVIRONMENT_RAMP.length - 2, Math.floor(t));
  const [a, b] = [hexToRgba(ENVIRONMENT_RAMP[i]), hexToRgba(ENVIRONMENT_RAMP[i + 1])];
  const f = t - i;
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)).concat(235) as Rgba;
}

function seriesOf(data: EnvironmentBundle, source: WeatherSourceId): EnvironmentSeries[] {
  return data.series.filter((s) => s.sourceId === source);
}

/**
 * Weekly weather for the CCHAIN cities, one source at a time. CCHAIN is a
 * population-weighted mean over each city's barangays; Open-Meteo is one ERA5
 * grid cell at the city's population-weighted centroid. Points are colored on
 * a one-hue ramp; incomplete weeks are drawn as no data, never filled.
 */
function prepare(bundle: MapDataBundle, filters: MapFilters): PreparedMode {
  const data = bundle.environment;
  if (!data) {
    return bundle.environmentError
      ? { ...EMPTY, legend: { ...EMPTY.legend, metric: `Weather could not be loaded: ${bundle.environmentError}` } }
      : EMPTY;
  }
  const variable = filters.envVariable;
  const source = filters.envSource;
  const meta = WEATHER_VARIABLE_META[variable];
  const series = seriesOf(data, source);
  const geo = new Map(data.geographies.map((g) => [g.id, g]));
  const domain = rampDomain(series, variable);

  // Each series' first week as an offset into the shared calendar, so a week is an index, not a date parse.
  const calendar = sourceWeeks(series);
  const offset = series.map((s) => calendar.indexOf(s.firstPeriodStart));
  const indexIn = (k: number, c: number) => {
    const i = c - offset[k];
    return i >= 0 && i < series[k].daysObserved.length ? i : -1;
  };

  // A week with no value for any city is a gap in the record, not a zero.
  const weeks: Array<{ week: string; calendarIndex: number; mean: number }> = [];
  calendar.forEach((week, c) => {
    let sum = 0;
    let count = 0;
    series.forEach((s, k) => {
      const i = indexIn(k, c);
      const v = i < 0 ? null : s.values[variable][i];
      if (v !== null) {
        sum += v;
        count++;
      }
    });
    if (count > 0) weeks.push({ week, calendarIndex: c, mean: sum / count });
  });

  const slices = weeks.map(({ week, mean }, n) => ({
    key: week,
    label: `Week of ${WEEK_LABEL.format(utc(week))}`,
    shortLabel: MONTH_LABEL.format(utc(week)),
    value: mean,
    gapBefore: n > 0 && weeks[n].calendarIndex - weeks[n - 1].calendarIndex > 1,
  }));

  return {
    timeline: {
      slices,
      trackLabel: `${meta.label}: mean across cities with data`,
      interpretation:
        "One Sunday–Saturday week per step. Breaks mark weeks with no data for any city; incomplete weeks are never filled.",
      formatValue: meta.format,
    },
    legend: {
      title: `${meta.label} · ${WEATHER_SOURCE_LABEL[source]}`,
      metric: `Weekly ${meta.label.toLowerCase()} (${meta.unit}); ${data.sources[source].aggregationMethod.replaceAll("_", " ")}`,
      classification: "linear",
      ramp: {
        colors: [...ENVIRONMENT_RAMP],
        minLabel: `≤ ${meta.format(domain[0])}`,
        maxLabel: `≥ ${meta.format(domain[1])}`,
      },
      classes: [{ label: "No data (incomplete week)", color: ENVIRONMENT_NO_DATA_HEX }],
      opacity: source === "open_meteo" ? { label: "Faded: provisional ERA5T week" } : undefined,
      note:
        variable === "precipitation_mm"
          ? `${ENVIRONMENT_NOTE} CCHAIN rainfall (CHIRPS) and Open-Meteo rainfall (ERA5) disagree, so the two are never mixed.`
          : ENVIRONMENT_NOTE,
    },
    frameAt(index) {
      const slice = weeks[Math.min(index, weeks.length - 1)];
      if (!slice) return { features: [], links: [] };
      const features: MapFeature[] = series.flatMap((s, k) => {
        const g = geo.get(s.geographyId);
        if (!g) return [];
        const i = indexIn(k, slice.calendarIndex);
        const value = i < 0 ? null : s.values[variable][i];
        const flags = i < 0 ? [] : qcFlagsAt(s, i);
        const provisional = flags.includes("provisional_era5t");
        const color: Rgba =
          value === null ? hexToRgba(ENVIRONMENT_NO_DATA_HEX, 220) : provisional ? [...rampColor(value, domain).slice(0, 3), 140] as Rgba : rampColor(value, domain);
        const rows: DetailRow[] = [
          { label: meta.label, value: value === null ? "No data" : meta.format(value) },
          { label: "Days observed", value: i < 0 ? "Outside coverage" : `${s.daysObserved[i]} of 7` },
          { label: "Quality", value: flags.length ? flags.map((f) => QC_FLAG_LABEL[f]).join("; ") : "OK" },
          { label: "Source", value: WEATHER_SOURCE_LABEL[source] },
          { label: "Dengue join", value: RELATION_LABEL[g.hdxUnitRelation] },
        ];
        return [
          {
            id: g.id,
            name: g.name,
            position: [g.longitude, g.latitude] as [number, number],
            color,
            radius: value === null ? 6 : 9,
            classLabel:
              value === null
                ? i < 0
                  ? "Outside this source's coverage"
                  : "No data (incomplete week)"
                : `${meta.format(value)}${provisional ? " · provisional" : ""}`,
            kind: "area" as const,
            rank: value ?? Number.NEGATIVE_INFINITY,
            rows,
          },
        ];
      });
      return { features, links: [] };
    },
  };
}

export const ENVIRONMENT_MODE: MapModeDefinition = {
  id: "environment",
  label: "Environment",
  question: "What weather surrounded the signals?",
  availability: "observed",
  evidence: "context",
  evidenceLabel: "Weekly city weather: CCHAIN (2003–2022) and Open-Meteo ERA5 (2008–present), 12 CCHAIN cities",
  extent: "national",
  filters: ["envVariable", "envSource"],
  layerToggles: [],
  prepare,
};
