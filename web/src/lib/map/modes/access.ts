import { ACCESS_METRIC_LABEL, GAP_LABEL, metricFor, stateFor } from "@/lib/access/bundle";
import { facilityTypeLabel } from "@/lib/access/labels";
import { formatCount, formatIsoDate } from "../format";
import {
  AVAILABILITY_HEX,
  DEMAND_RAMP,
  FRESHNESS_HEX,
  GAP_HEX,
  hexToRgba,
} from "../palette";
import type {
  LegendSpec,
  MapDataBundle,
  MapFeature,
  MapFilters,
  MapModeDefinition,
  PreparedMode,
} from "../types";

const AVAILABILITY_LABEL = {
  available: "Available",
  low: "Low",
  unavailable: "Reported unavailable",
  unknown: "Unknown",
} as const;

const FRESHNESS_LABEL = {
  fresh: "Fresh",
  aging: "Aging",
  stale: "Stale",
  unknown: "No report",
} as const;

function reportAge(hours: number | null): string {
  if (hours === null) return "No report";
  return hours < 48 ? `${hours}h before week end` : `${Math.round(hours / 24)}d before week end`;
}

function legendFor(metric: MapFilters["accessMetric"], medicine: string, t: { fresh: number; aging: number }): LegendSpec {
  switch (metric) {
    case "availability":
      return {
        title: "Availability",
        metric: `Latest facility report for ${medicine}`,
        classification: "categorical",
        classes: (Object.keys(AVAILABILITY_LABEL) as Array<keyof typeof AVAILABILITY_LABEL>).map((k) => ({
          label: AVAILABILITY_LABEL[k],
          color: AVAILABILITY_HEX[k],
        })),
        opacity: { label: "Faded point: stale report. Treated as uncertain, not unavailable." },
        note: "Demo inventory. Reported states are not verified stock levels.",
      };
    case "freshness":
      return {
        title: "Inventory freshness",
        metric: "Time between a facility's last report and the week end",
        classification: "threshold",
        classes: [
          { label: FRESHNESS_LABEL.fresh, color: FRESHNESS_HEX.fresh, range: `< ${t.fresh}h` },
          { label: FRESHNESS_LABEL.aging, color: FRESHNESS_HEX.aging, range: `${t.fresh}–${t.aging}h` },
          { label: FRESHNESS_LABEL.stale, color: FRESHNESS_HEX.stale, range: `> ${t.aging}h` },
          { label: FRESHNESS_LABEL.unknown, color: FRESHNESS_HEX.unknown, range: "—" },
        ],
        note: "Prototype thresholds, not a validated operational standard.",
      };
    case "demand":
      return {
        title: "Search demand",
        metric: `Demo searches for ${medicine} in the selected week, by area`,
        classification: "linear",
        ramp: { colors: [...DEMAND_RAMP], minLabel: "Low", maxLabel: "High" },
        height: { label: "Column height (3D): searches in the area" },
        note: "Aggregate, non-identifying search counts. A search is a demand signal, not a case or a shortage.",
      };
    case "gap":
      return {
        title: "Potential access gap",
        metric: "Demand vs. confirmed availability, given reporting coverage",
        classification: "threshold",
        classes: (["elevated", "moderate", "low", "insufficient_data"] as const).map((k) => ({
          label: GAP_LABEL[k],
          color: GAP_HEX[k],
        })),
        height: { label: "Column height (3D): searches in the area" },
        note: "Illustrative analytical classes, not clinically validated thresholds, and not a shortage determination.",
      };
  }
}

function prepare(bundle: MapDataBundle, filters: MapFilters): PreparedMode {
  const access = bundle.access;
  const medicine = access.medicines.find((m) => m.id === filters.medicine) ?? access.medicines[0];
  const lguById = new Map(bundle.lgus.map((l) => [l.id, l]));
  const areaIds = [...new Set(access.facilities.map((f) => f.areaId))].filter((id) => lguById.has(id));
  const metric = filters.accessMetric;

  const weeklyTotals = access.weeks.map((w) =>
    areaIds.reduce((sum, a) => sum + (metricFor(access, a, medicine.id, w.index)?.searchDemand ?? 0), 0),
  );
  const maxDemand = Math.max(
    1,
    ...access.weeks.flatMap((w) => areaIds.map((a) => metricFor(access, a, medicine.id, w.index)?.searchDemand ?? 0)),
  );

  return {
    timeline: {
      slices: access.weeks.map((w, i) => ({
        key: w.periodStart,
        label: `Week of ${formatIsoDate(w.periodStart)}`,
        shortLabel: formatIsoDate(w.periodStart, { month: "short", day: "numeric" }),
        value: weeklyTotals[i],
        gapBefore: false,
      })),
      trackLabel: `Demo searches for ${medicine.name} per week`,
      interpretation: `${ACCESS_METRIC_LABEL[metric]} for ${medicine.name} as of the end of the selected week.`,
      formatValue: (v) => `${formatCount(v)} searches`,
    },
    legend: legendFor(metric, medicine.name, access.freshnessThresholds),
    frameAt(index) {
      const week = Math.min(index, access.weeks.length - 1);
      const features: MapFeature[] = [];

      if (metric === "availability" || metric === "freshness") {
        for (const f of access.facilities) {
          const s = stateFor(access, f.id, medicine.id, week);
          if (!s) continue;
          const stale = s.freshness === "stale";
          const color =
            metric === "availability"
              ? hexToRgba(AVAILABILITY_HEX[s.availability], stale ? 110 : 240)
              : hexToRgba(FRESHNESS_HEX[s.freshness], 240);
          const classLabel =
            metric === "availability"
              ? `${AVAILABILITY_LABEL[s.availability]}${stale ? " (stale report)" : ""}`
              : FRESHNESS_LABEL[s.freshness];
          features.push({
            id: f.id,
            name: f.name,
            kind: "facility",
            position: [f.longitude, f.latitude],
            color,
            radius: 6,
            classLabel,
            rank: { unavailable: 3, low: 2, unknown: 1, available: 0 }[s.availability],
            rows: [
              { label: "Type", value: facilityTypeLabel(f.type) },
              { label: "Availability", value: AVAILABILITY_LABEL[s.availability] },
              { label: "Freshness", value: FRESHNESS_LABEL[s.freshness] },
              { label: "Last report", value: reportAge(s.ageHours) },
            ],
          });
        }
      } else {
        for (const areaId of areaIds) {
          const m = metricFor(access, areaId, medicine.id, week);
          const lgu = lguById.get(areaId);
          if (!m || !lgu) continue;
          const demandShare = m.searchDemand / maxDemand;
          const color =
            metric === "gap"
              ? hexToRgba(GAP_HEX[m.accessGap], 240)
              : hexToRgba(DEMAND_RAMP[Math.min(DEMAND_RAMP.length - 1, Math.floor(demandShare * DEMAND_RAMP.length))], 230);
          features.push({
            id: areaId,
            name: lgu.name,
            kind: "area",
            position: [lgu.longitude, lgu.latitude],
            color,
            radius: metric === "gap" ? 11 : 8,
            elevation: demandShare,
            classLabel: metric === "gap" ? `${GAP_LABEL[m.accessGap]} access gap` : `${formatCount(m.searchDemand)} searches`,
            rank: metric === "gap" ? { elevated: 3, moderate: 2, insufficient_data: 1, low: 0 }[m.accessGap] * 1000 + m.searchDemand : m.searchDemand,
            rows: [
              { label: "Access gap", value: `${GAP_LABEL[m.accessGap]} · ${m.confidence} confidence` },
              { label: "Search demand", value: `${formatCount(m.searchDemand)} (${m.demandRatio.toFixed(1)}x early level)` },
              { label: "Confirmed available", value: `${m.confirmedAvailable} of ${m.facilities} facilities` },
              { label: "Reporting coverage", value: `${Math.round(m.facilityCoverage * 100)}%` },
            ],
          });
        }
      }

      const heat =
        metric === "demand"
          ? areaIds.flatMap((areaId) => {
              const m = metricFor(access, areaId, medicine.id, week);
              const lgu = lguById.get(areaId);
              return m && lgu ? [{ position: [lgu.longitude, lgu.latitude] as [number, number], weight: m.searchDemand }] : [];
            })
          : undefined;

      return {
        features,
        links: [],
        heat,
        heatColors: heat ? DEMAND_RAMP.map((hex) => hexToRgba(hex, 255)) : undefined,
      };
    },
  };
}

export const ACCESS_MODE: MapModeDefinition = {
  id: "access",
  label: "Access",
  question: "Where might medicine access gaps be emerging?",
  availability: "demo",
  evidence: "context",
  evidenceLabel: "Access indicators (demo inventory and searches)",
  extent: "metro",
  filters: ["medicine", "accessMetric"],
  layerToggles: ["columns"],
  prepare,
};
