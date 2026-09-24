import type { TrendPoint } from "@/types";
import { formatCount, formatIsoDate } from "../format";
import { ANOMALY_HEX, hexToRgba } from "../palette";
import type {
  LegendClass,
  MapDataBundle,
  MapFeature,
  MapFilters,
  MapModeDefinition,
  PreparedMode,
} from "../types";

/** Score that maps to a full-height column. */
const MAX_SCORE = 4;

/**
 * Demo thresholds on the deviation score. They mirror lib/anomaly's labels
 * and are NOT validated epidemiological alert thresholds.
 */
const CLASSES: Array<LegendClass & { min: number }> = [
  { label: "Elevated from baseline", range: "≥ 2", color: ANOMALY_HEX.elevated, min: 2 },
  { label: "Above expected range", range: "1 to 2", color: ANOMALY_HEX.above, min: 1 },
  { label: "Within historical range", range: "−1 to 1", color: ANOMALY_HEX.within, min: -1 },
  { label: "Below expected range", range: "−2 to −1", color: ANOMALY_HEX.below, min: -2 },
  { label: "Well below expected", range: "< −2", color: ANOMALY_HEX.wellBelow, min: -Infinity },
];

/** (observed − expected) ÷ half-width of the expected range. */
export function deviationScore(point: TrendPoint): number {
  const halfWidth = (point.upperBound - point.lowerBound) / 2 || 1;
  return (point.observed - point.expected) / halfWidth;
}

function classify(score: number) {
  return CLASSES.find((c) => score >= c.min) ?? CLASSES[CLASSES.length - 1];
}

function prepare(bundle: MapDataBundle, filters: MapFilters): PreparedMode {
  const lgus = bundle.lgus.filter(
    (lgu) =>
      bundle.trends[lgu.id]?.length &&
      (filters.geography === "all" || lgu.province === filters.geography),
  );
  const reference = bundle.trends[lgus[0]?.id ?? ""] ?? [];

  const slices = reference.map((point, i) => ({
    key: point.date,
    label: `Week of ${formatIsoDate(point.date)}`,
    shortLabel: formatIsoDate(point.date, { month: "short", day: "numeric" }),
    value: lgus.filter((lgu) => {
      const p = bundle.trends[lgu.id][i];
      return p ? deviationScore(p) >= 2 : false;
    }).length,
    gapBefore: false,
  }));

  return {
    timeline: {
      slices,
      trackLabel: "Areas scoring ≥ 2 per week (demo model)",
      interpretation:
        "Map shows each area's deviation from its expected baseline for the selected week.",
      formatValue: (v) => `${formatCount(v)} area${v === 1 ? "" : "s"} ≥ 2`,
    },
    legend: {
      title: "Deviation from baseline",
      metric: "Score = (observed − expected) ÷ half-width of expected range",
      classification: "threshold",
      classes: CLASSES.map(({ label, range, color }) => ({ label, range, color })),
      height: { label: "Column height (3D): positive deviation, capped at 4" },
      note: "Demo model output on a composite signal index. Thresholds are illustrative, not validated.",
    },
    frameAt(index) {
      const features: MapFeature[] = [];
      for (const lgu of lgus) {
        const point = bundle.trends[lgu.id][index];
        if (!point) continue;
        const score = deviationScore(point);
        const cls = classify(score);
        features.push({
          id: lgu.id,
          name: lgu.name,
          position: [lgu.longitude, lgu.latitude],
          color: hexToRgba(cls.color, 240),
          radius: 9,
          elevation: Math.max(0, Math.min(score, MAX_SCORE)) / MAX_SCORE,
          classLabel: cls.label,
          rank: score,
          rows: [
            { label: "Deviation score", value: score.toFixed(2) },
            { label: "Observed index", value: point.observed.toFixed(1) },
            {
              label: "Expected (range)",
              value: `${point.expected.toFixed(1)} (${point.lowerBound.toFixed(1)}–${point.upperBound.toFixed(1)})`,
            },
            { label: "Week of", value: formatIsoDate(point.date) },
          ],
        });
      }
      return { features, links: [] };
    },
  };
}

export const ANOMALY_MODE: MapModeDefinition = {
  id: "anomaly",
  label: "Anomaly",
  question: "Which areas deviate from their expected baseline?",
  availability: "demo",
  evidence: "model_output",
  evidenceLabel: "Model output on signals (demo)",
  extent: "metro",
  filters: ["geography"],
  layerToggles: ["columns"],
  prepare,
};
