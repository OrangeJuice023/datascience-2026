import type { Signal } from "@/types";
import { CONFIDENCE_LABEL, SEVERITY_ORDER, SIGNAL_STATUS_CONFIG } from "@/lib/status";
import { addDaysIso, formatMultiplier } from "@/lib/utils";
import { daysBetweenIso, formatCount, formatIsoDate } from "../format";
import { NEUTRAL_LINK_HEX, STATUS_HEX, hexToRgba } from "../palette";
import type {
  MapDataBundle,
  MapFeature,
  MapFilters,
  MapLink,
  MapModeDefinition,
  PreparedMode,
  TimelineSlice,
} from "../types";

/** Signal level (x baseline) that maps to a full-height column. */
const MAX_SIGNAL_LEVEL = 3;

export function applySignalFilters(bundle: MapDataBundle, filters: MapFilters): Signal[] {
  const provinceById = new Map(bundle.lgus.map((lgu) => [lgu.id, lgu.province]));
  return bundle.signals.filter((signal) => {
    if (filters.disease !== "all" && signal.disease !== filters.disease) return false;
    if (filters.status !== "all" && signal.status !== filters.status) return false;
    if (filters.confidence !== "all" && signal.confidence !== filters.confidence) return false;
    if (filters.geography !== "all" && provinceById.get(signal.locationId) !== filters.geography) {
      return false;
    }
    return true;
  });
}

function prepare(bundle: MapDataBundle, filters: MapFilters): PreparedMode {
  const signals = applySignalFilters(bundle, filters);
  const lguById = new Map(bundle.lgus.map((lgu) => [lgu.id, lgu]));
  const windowDays = filters.window === "all" ? Infinity : Number(filters.window);

  // Daily slices over the full (unfiltered) reporting span, so filtering
  // never shifts the time axis under the user.
  const dates = bundle.signals.map((s) => s.date).sort();
  const first = dates[0];
  const span = first ? daysBetweenIso(first, dates[dates.length - 1]) : -1;
  const slices: TimelineSlice[] = Array.from({ length: span + 1 }, (_, i) => {
    const key = addDaysIso(first, i);
    return {
      key,
      label: formatIsoDate(key),
      shortLabel: formatIsoDate(key, { month: "short", day: "numeric" }),
      value: signals.filter((s) => s.date === key).length,
      gapBefore: false,
    };
  });

  const windowText =
    windowDays === Infinity ? "all signals reported up to" : `signals reported in the ${windowDays} days up to`;

  return {
    timeline: {
      slices,
      trackLabel: "Demo signals reported per day",
      interpretation: `Map shows ${windowText} the selected date; each area takes its most severe signal.`,
      formatValue: (v) => `${formatCount(v)} signal${v === 1 ? "" : "s"}`,
    },
    legend: {
      title: "Signal status",
      metric: "Most severe open-source signal per area",
      classification: "categorical",
      classes: (["normal", "watch", "elevated"] as const).map((status) => ({
        label: SIGNAL_STATUS_CONFIG[status].label,
        color: STATUS_HEX[status],
      })),
      size: { label: "Point size: unique sources", minLabel: "1", maxLabel: "9+" },
      height: { label: "Column height (3D): signal level vs. baseline, up to 3.0x" },
      note: "Demo signals. A signal is not a confirmed case count and requires verification.",
    },
    frameAt(index, toggles) {
      const cursor = slices[Math.min(index, slices.length - 1)]?.key;
      if (!cursor) return { features: [], links: [] };

      const inWindow = signals.filter((s) => {
        const age = daysBetweenIso(s.date, cursor);
        return age >= 0 && age < windowDays;
      });

      const byLocation = new Map<string, Signal[]>();
      for (const signal of inWindow) {
        const list = byLocation.get(signal.locationId) ?? [];
        list.push(signal);
        byLocation.set(signal.locationId, list);
      }

      const features: MapFeature[] = [];
      byLocation.forEach((list, locationId) => {
        const lgu = lguById.get(locationId);
        if (!lgu) return;
        const top = [...list].sort(
          (a, b) =>
            SEVERITY_ORDER[b.status] - SEVERITY_ORDER[a.status] || b.date.localeCompare(a.date),
        )[0];
        const status = SIGNAL_STATUS_CONFIG[top.status];
        features.push({
          id: locationId,
          name: lgu.name,
          position: [lgu.longitude, lgu.latitude],
          color: hexToRgba(STATUS_HEX[top.status], 235),
          radius: 6 + Math.min(top.sourceCount, 9) * 0.9,
          elevation: Math.min(top.signalLevel, MAX_SIGNAL_LEVEL) / MAX_SIGNAL_LEVEL,
          classLabel: status.label,
          rank: SEVERITY_ORDER[top.status] * 10 + top.signalLevel,
          rows: [
            { label: "Top signal", value: `${top.disease} · ${status.label}` },
            { label: "Signal level", value: formatMultiplier(top.signalLevel) },
            { label: "Sources", value: `${top.sourceCount} · ${CONFIDENCE_LABEL[top.confidence]}` },
            { label: "Reported", value: formatIsoDate(top.date) },
            { label: "Signals in window", value: String(list.length) },
          ],
        });
      });

      const links: MapLink[] = [];
      if (toggles.links) {
        // Nearest-neighbor relationships from each elevated area; a link is
        // warm only when the neighbor is also elevated in this window.
        const elevated = SIGNAL_STATUS_CONFIG.elevated.label;
        const classById = new Map(features.map((f) => [f.id, f.classLabel]));
        const seen = new Set<string>();
        for (const feature of features) {
          if (feature.classLabel !== elevated) continue;
          for (const neighbor of bundle.neighbors[feature.id] ?? []) {
            const lgu = lguById.get(neighbor.locationId);
            const pairKey = [feature.id, neighbor.locationId].sort().join("|");
            if (!lgu || seen.has(pairKey)) continue;
            seen.add(pairKey);
            const bothElevated = classById.get(neighbor.locationId) === elevated;
            links.push({
              id: `${feature.id}->${neighbor.locationId}`,
              from: feature.position,
              to: [lgu.longitude, lgu.latitude],
              color: hexToRgba(bothElevated ? STATUS_HEX.elevated : NEUTRAL_LINK_HEX, 150),
            });
          }
        }
      }

      return { features, links };
    },
  };
}

export const SIGNALS_MODE: MapModeDefinition = {
  id: "signals",
  label: "Signals",
  question: "Where are open-source signals appearing?",
  availability: "demo",
  evidence: "public_health_signals",
  evidenceLabel: "Open-source signals (demo)",
  extent: "metro",
  filters: ["disease", "geography", "status", "confidence", "window"],
  layerToggles: ["links", "columns"],
  prepare,
};
