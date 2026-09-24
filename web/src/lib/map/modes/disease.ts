import { daysBetweenIso, formatCount, formatIsoDate } from "../format";
import type { MapDataBundle, MapModeDefinition, PreparedMode } from "../types";

/**
 * Formal observations. OpenDengue v1.3 for the Philippines is national-only,
 * so this mode deliberately draws no spatial layer: a national total placed
 * on a map point would read as a location of cases.
 */
function prepare(bundle: MapDataBundle): PreparedMode {
  const weeks = bundle.nationalWeekly;

  const slices = weeks.map((obs, i) => ({
    key: obs.periodStart,
    label: `Week of ${formatIsoDate(obs.periodStart)}`,
    shortLabel: formatIsoDate(obs.periodStart, { month: "short", year: "numeric" }),
    value: obs.value,
    gapBefore: i > 0 && daysBetweenIso(weeks[i - 1].periodStart, obs.periodStart) > 7,
  }));

  return {
    timeline: {
      slices,
      trackLabel: "Reported dengue cases per week, national (OpenDengue)",
      interpretation:
        "Weekly national totals only. Breaks in the track mark periods with no weekly record.",
      formatValue: (v) => `${formatCount(v)} cases`,
    },
    legend: {
      title: "Formal observations",
      metric: "Weekly dengue cases, Philippines (national)",
      classification: "none",
      note: "No sub-national formal data is available, so no case layer is drawn on the map.",
    },
    frameAt(index) {
      const obs = weeks[Math.min(index, weeks.length - 1)];
      if (!obs) return { features: [], links: [] };
      return {
        features: [],
        links: [],
        national: {
          title: "Philippines · national total",
          value: `${formatCount(obs.value)} cases`,
          period: `${formatIsoDate(obs.periodStart)} – ${formatIsoDate(obs.periodEnd)}`,
          rows: [
            { label: "Source", value: "OpenDengue v1.3 (CC BY 4.0)" },
            { label: "Case definition", value: "Total (as reported upstream)" },
            { label: "Resolution", value: "National · weekly" },
          ],
        },
      };
    },
  };
}

export const DISEASE_MODE: MapModeDefinition = {
  id: "disease",
  label: "Disease",
  question: "What do formal case reports show?",
  availability: "observed",
  evidence: "health_observations",
  evidenceLabel: "Formal observations (OpenDengue)",
  extent: "national",
  filters: [],
  layerToggles: [],
  prepare,
};
