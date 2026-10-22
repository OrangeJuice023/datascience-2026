import {
  SIGMA_BOUNDARIES_URL,
  dohClass,
  dohReason,
  earsClass,
  earsReason,
  hasData,
  isDohCrossing,
  isEarsAlarm,
  weekOf,
  weeksWithData,
  type DohClass,
  type EarsClass,
  type SigmaWeek,
} from "@/lib/sigma/data";
import { formatCount, formatIsoDate } from "../format";
import { SIGMA_HEX, hexToRgba } from "../palette";
import type {
  DetailRow,
  LegendClass,
  MapDataBundle,
  MapFeature,
  MapFilters,
  MapModeDefinition,
  PreparedMode,
  SigmaLayer,
} from "../types";

/** Required wording wherever signal states are drawn (docs/geo/spatial-assessment-and-method.md §5). */
export const SIGMA_STATE_NOTE =
  "Signal status relative to each area's own history — not a measure of local risk or incidence.";
const CAUTION = "Retrospective prototype on 2016–2021 data; not a validated outbreak signal.";

export const EARS_CLASSES: Record<EarsClass, LegendClass> = {
  alarm: { label: "EARS alarm (C1, C2 or C3)", color: SIGMA_HEX.alarm },
  none: { label: "No alarm", color: SIGMA_HEX.quiet },
  not_computed: { label: "Not computed (short baseline)", color: SIGMA_HEX.notEvaluated },
  no_data: { label: "No data (missing or suspect week)", color: SIGMA_HEX.noData },
};

export const DOH_CLASSES: Record<DohClass, LegendClass> = {
  epidemic: { label: "Above epidemic threshold", color: SIGMA_HEX.epidemic },
  alert: { label: "Above alert threshold", color: SIGMA_HEX.alert },
  normal: { label: "At or below alert threshold", color: SIGMA_HEX.quiet },
  no_baseline: { label: "No threshold (before 2019)", color: SIGMA_HEX.notEvaluated },
  no_data: { label: "No data (missing or suspect week)", color: SIGMA_HEX.noData },
};

const CASES_CLASSES: Record<"reported" | "no_data", LegendClass> = {
  reported: { label: "Reported cases", color: SIGMA_HEX.cases },
  no_data: { label: "No data (missing or suspect week)", color: SIGMA_HEX.noData },
};

const LAYER_COPY: Record<SigmaLayer, { title: string; metric: string; track: string; unit: (v: number) => string }> = {
  ears: {
    title: "EARS signal",
    metric: "CDC EARS C1–C3 on weekly reported cases, per reporting unit",
    track: "Reporting units with an EARS alarm per week",
    unit: (v) => `${formatCount(v)} unit${v === 1 ? "" : "s"} alarmed`,
  },
  doh: {
    title: "DOH threshold",
    metric: "Weekly cases vs. the DOH alert (3-year mean) and epidemic (+2 SD) thresholds",
    track: "Reporting units above the DOH alert threshold per week",
    unit: (v) => `${formatCount(v)} unit${v === 1 ? "" : "s"} above alert`,
  },
  cases: {
    title: "Reported cases",
    metric: "Weekly dengue cases as reported by DOH-EB (HDX), per reporting unit",
    track: "Reported cases per week, units with data that week",
    unit: (v) => `${formatCount(v)} cases`,
  },
};

const EMPTY: PreparedMode = {
  timeline: { slices: [], trackLabel: "", interpretation: "", formatValue: String },
  legend: { title: "SIGMA", metric: "Loading reporting-unit results…", classification: "none" },
  frameAt: () => ({ features: [], links: [] }),
};

function classOf(layer: SigmaLayer, w: SigmaWeek): LegendClass {
  if (layer === "ears") return EARS_CLASSES[earsClass(w)];
  if (layer === "doh") return DOH_CLASSES[dohClass(w)];
  return hasData(w) ? CASES_CLASSES.reported : CASES_CLASSES.no_data;
}

function rankOf(layer: SigmaLayer, w: SigmaWeek): number {
  if (!hasData(w)) return -1;
  if (layer === "cases") return w.value ?? 0;
  if (layer === "doh") return { epidemic: 3, alert: 2, normal: 1, no_baseline: 0, no_data: -1 }[dohClass(w)];
  const stat = Math.max(w.c1 ?? 0, w.c2 ?? 0, w.c3 ?? 0);
  return isEarsAlarm(w) ? 1000 + stat : stat;
}

function rowsFor(layer: SigmaLayer, w: SigmaWeek, region: string, reasons: { ears: string; doh: string }): DetailRow[] {
  const cases: DetailRow = { label: "Reported cases", value: hasData(w) ? formatCount(w.value ?? 0) : "No data" };
  const ears: DetailRow = { label: "EARS", value: reasons.ears };
  const doh: DetailRow = { label: "DOH threshold", value: reasons.doh };
  const quality: DetailRow = { label: "Data", value: w.flag ? `${w.quality} · ${w.flag}` : w.quality };
  const ordered = layer === "doh" ? [doh, cases, ears] : layer === "cases" ? [cases, quality, ears] : [ears, cases, doh];
  return [...ordered, ...(layer === "cases" ? [doh] : [quality]), { label: "Region", value: region }];
}

/**
 * SIGMA results per HDX reporting unit: observed counts, EARS signals and
 * DOH threshold crossings as separate layers. Points sit at each unit's
 * representative point; optional area fills show categorical states only.
 */
function prepare(bundle: MapDataBundle, filters: MapFilters): PreparedMode {
  const data = bundle.sigma;
  if (!data) {
    return bundle.sigmaError
      ? { ...EMPTY, legend: { ...EMPTY.legend, metric: `Results could not be loaded: ${bundle.sigmaError}` } }
      : EMPTY;
  }
  const layer = filters.sigmaLayer;
  const copy = LAYER_COPY[layer];
  const weeks = data.meta.weeks;
  // A week where no unit has data (e.g. 2019-01-06) is a gap in the record, not a zero.
  const indices = weeksWithData(data);

  let maxValue = 1;
  for (const unit of data.units) for (const v of unit.value) if (v !== null && v > maxValue) maxValue = v;
  const radius = (w: SigmaWeek) => (hasData(w) ? 4 + 12 * Math.sqrt((w.value ?? 0) / maxValue) : 3);

  const slices = indices.map((wi, n) => {
    let value = 0;
    for (const unit of data.units) {
      const w = weekOf(data, unit, wi);
      if (layer === "cases") value += hasData(w) ? (w.value ?? 0) : 0;
      else if (layer === "ears" ? isEarsAlarm(w) : isDohCrossing(w)) value++;
    }
    return {
      key: weeks[wi],
      label: `Week of ${formatIsoDate(weeks[wi])}`,
      shortLabel: formatIsoDate(weeks[wi], { month: "short", year: "numeric" }),
      value,
      gapBefore: n > 0 && wi - indices[n - 1] > 1,
    };
  });

  const classes =
    layer === "ears" ? Object.values(EARS_CLASSES) : layer === "doh" ? Object.values(DOH_CLASSES) : Object.values(CASES_CLASSES);

  return {
    timeline: {
      slices,
      trackLabel: copy.track,
      interpretation:
        layer === "doh"
          ? "DOH thresholds need 3 prior years, so they start in 2019. Breaks mark weeks with no data for any unit."
          : "Breaks mark weeks with no data for any unit. Missing and suspect weeks are never counted as zero.",
      formatValue: copy.unit,
    },
    legend: {
      title: copy.title,
      metric: copy.metric,
      classification: "categorical",
      classes,
      size: { label: "Marker size: reported cases (not population-adjusted)", minLabel: "0", maxLabel: formatCount(maxValue) },
      note: layer === "cases" ? CAUTION : `${SIGMA_STATE_NOTE} ${CAUTION}`,
    },
    frameAt(index, toggles) {
      const wi = indices[Math.min(index, indices.length - 1)];
      if (wi === undefined) return { features: [], links: [] };
      const features: MapFeature[] = data.units.map((unit) => {
        const w = weekOf(data, unit, wi);
        const cls = classOf(layer, w);
        return {
          id: unit.id,
          name: unit.name,
          position: unit.point,
          color: hexToRgba(cls.color, hasData(w) ? 235 : 200),
          radius: radius(w),
          classLabel: cls.label,
          kind: "area",
          rank: rankOf(layer, w),
          rows: rowsFor(layer, w, unit.region, { ears: earsReason(w, data), doh: dohReason(w) }),
        };
      });
      return {
        features,
        links: [],
        // Area fills are for categorical states only, never for counts.
        areas:
          toggles.areas && layer !== "cases"
            ? {
                url: SIGMA_BOUNDARIES_URL,
                fills: Object.fromEntries(
                  features.map((f) => [f.id, [f.color[0], f.color[1], f.color[2], f.rank < 0 ? 90 : 150]]),
                ),
              }
            : undefined,
      };
    },
  };
}

export const SIGMA_MODE: MapModeDefinition = {
  id: "sigma",
  label: "SIGMA",
  question: "Did EARS warn before DOH thresholds were crossed?",
  availability: "observed",
  evidence: "model_output",
  evidenceLabel: "EARS and DOH thresholds on DOH-EB reporting-unit counts (HDX, 2016–2021)",
  extent: "national",
  filters: ["sigmaLayer"],
  layerToggles: ["areas"],
  defaultToggles: { areas: true },
  prepare,
};
