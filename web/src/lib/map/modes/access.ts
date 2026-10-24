import { SIGMA_BOUNDARIES_URL } from "@/lib/sigma/data";
import {
  ACCESS_REFERENCE,
  FACILITY_TYPES,
  FACILITY_TYPE_LABEL,
  type AccessFacilityType,
} from "@/lib/access/reference";
import { formatCount, formatIsoDate } from "../format";
import { hexToRgba } from "../palette";
import type { LegendClass, MapDataBundle, MapFeature, MapFilters, MapModeDefinition, PreparedMode, Rgba } from "../types";

/**
 * ACCESS: health facilities and pharmacies mapped in OpenStreetMap (HOT export
 * on HDX), as points, with each dengue reporting unit shaded by how many of
 * the selected kind are mapped per 100 km². A snapshot, so the timeline has a
 * single slice. Mapping completeness varies; the legend says so.
 */
const TYPE_HEX: Record<AccessFacilityType, string> = {
  hospital: "#b42318",
  clinic: "#0e7490",
  pharmacy: "#2f7a5f",
  laboratory: "#7c3aed",
};

/** Mapped facilities per 100 km²: fixed bins, so units compare across the map. */
const DENSITY_BINS: { max: number; label: string; hex: string }[] = [
  { max: 0, label: "None mapped", hex: "#f1f5f9" },
  { max: 1, label: "Under 1 per 100 km²", hex: "#d9ede4" },
  { max: 5, label: "1 – 5 per 100 km²", hex: "#a6d4bf" },
  { max: 20, label: "5 – 20 per 100 km²", hex: "#5fae8c" },
  { max: Infinity, label: "20 or more per 100 km²", hex: "#2f7a5f" },
];

const UNIT_NAME = new Map(ACCESS_REFERENCE.units.map((u) => [u.id, u.name]));
const HOT_SOURCE = ACCESS_REFERENCE.meta.sources.find((s) => s.id === "hotosm-phl-health-facilities");
const SNAPSHOT = HOT_SOURCE?.snapshot ?? "";

function densityBin(per100: number | null | undefined) {
  if (per100 === null || per100 === undefined) return null;
  return DENSITY_BINS.find((b) => per100 <= b.max) ?? DENSITY_BINS[DENSITY_BINS.length - 1];
}

const EMPTY: PreparedMode = {
  timeline: { slices: [], trackLabel: "", interpretation: "", formatValue: String },
  legend: { title: "ACCESS", metric: "Loading mapped facilities…", classification: "none" },
  frameAt: () => ({ features: [], links: [] }),
};

function prepare(bundle: MapDataBundle, filters: MapFilters): PreparedMode {
  const data = bundle.accessPoints;
  if (!data) {
    return bundle.accessPointsError
      ? { ...EMPTY, legend: { ...EMPTY.legend, metric: `Facilities could not be loaded: ${bundle.accessPointsError}` } }
      : EMPTY;
  }
  const type = filters.facilityType;
  const typeIndex = data.meta.types.indexOf(type);
  const color = hexToRgba(TYPE_HEX[type], 220);
  const total = data.points.filter((p) => p[2] === typeIndex).length;

  const classes: LegendClass[] = [
    { label: FACILITY_TYPE_LABEL[type], color: TYPE_HEX[type] },
    ...DENSITY_BINS.map((b) => ({ label: b.label, color: b.hex })),
  ];

  return {
    timeline: {
      slices: [
        {
          key: SNAPSHOT,
          label: `OpenStreetMap snapshot of ${formatIsoDate(SNAPSHOT)}`,
          shortLabel: formatIsoDate(SNAPSHOT, { month: "short", year: "numeric" }),
          value: total,
          gapBefore: false,
        },
      ],
      trackLabel: `${FACILITY_TYPE_LABEL[type]} mapped in OpenStreetMap`,
      interpretation: "One snapshot of current mapping; there is no weekly history.",
      formatValue: (v) => `${formatCount(v)} mapped`,
    },
    legend: {
      title: `${FACILITY_TYPE_LABEL[type]} (mapped)`,
      metric: "Points: places mapped in OpenStreetMap. Areas: mapped per 100 km² of each reporting unit.",
      classification: "categorical",
      classes,
      note:
        "Mapping completeness varies by place, so a low count can mean low mapping, not low access. Medicine stock is not shown: no public source reports it. © OpenStreetMap contributors, ODbL.",
    },
    frameAt(_index, toggles) {
      const features: MapFeature[] = [];
      for (let i = 0; i < data.points.length; i++) {
        const [lon, lat, t, u, name] = data.points[i];
        if (t !== typeIndex) continue;
        const unit = data.meta.units[u];
        features.push({
          id: `f${i}`,
          name: name ?? `Unnamed ${FACILITY_TYPE_LABEL[type].toLowerCase().replace(/s$/, "")}`,
          position: [lon, lat],
          color,
          radius: 3,
          classLabel: FACILITY_TYPE_LABEL[type].replace(/s$/, ""),
          kind: "facility",
          rank: 0,
          rows: [
            { label: "Type", value: FACILITY_TYPE_LABEL[type].replace(/s$/, "") },
            { label: "Reporting unit", value: UNIT_NAME.get(unit) ?? unit },
            { label: "Source", value: "OpenStreetMap (HOT export, ODbL)" },
            { label: "Medicine stock", value: "Unknown: no public source" },
          ],
        });
      }
      const fills: Record<string, Rgba> = {};
      if (toggles.areas) {
        for (const unit of ACCESS_REFERENCE.units) {
          const bin = densityBin(unit.mappedPer100SqKm?.[type]);
          if (bin) fills[unit.id] = hexToRgba(bin.hex, 170);
        }
      }
      return { features, links: [], areas: toggles.areas ? { url: SIGMA_BOUNDARIES_URL, fills } : undefined };
    },
  };
}

export const ACCESS_MODE: MapModeDefinition = {
  id: "access",
  label: "ACCESS",
  question: "Where are health facilities and pharmacies mapped, and how dense are they?",
  availability: "observed",
  evidence: "context",
  evidenceLabel: `Facilities and pharmacies mapped in OpenStreetMap (HOT export on HDX, snapshot ${SNAPSHOT})`,
  extent: "national",
  filters: ["facilityType"],
  layerToggles: ["areas"],
  defaultToggles: { areas: true },
  prepare,
};

export { FACILITY_TYPES, TYPE_HEX, densityBin };
