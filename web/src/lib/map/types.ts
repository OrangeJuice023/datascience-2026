import type { HealthObservation } from "@/types/data";
import type { AccessBundle } from "@/lib/access/bundle";
import type { LGU, NeighborSummary, SimulationInputs, Signal, TrendPoint } from "@/types";
import type { SigmaData } from "@/lib/sigma/data";
import type { EnvironmentBundle } from "@/lib/environment/bundle";
import type { WeatherSourceId, WeatherVariable } from "@/types/data";

export type MapViewMode = "2d" | "3d" | "globe";

export type MapModeId =
  | "signals"
  | "disease"
  | "anomaly"
  | "sigma"
  | "environment"
  | "access"
  | "simulation";

/**
 * What kind of evidence a mode draws. Kept explicit so the UI can never
 * present a signal-derived value, a model output or a scenario as a case count.
 */
export type ModeEvidence =
  | "public_health_signals"
  | "health_observations"
  | "model_output"
  | "scenario"
  /** Environmental or access covariates: inform analysis, never measure disease. */
  | "context";

/** demo = illustrative sample data; observed = real upstream data; planned = no source connected. */
export type ModeAvailability = "demo" | "observed" | "planned";

export type MapExtent = "metro" | "national";

export type Rgba = [number, number, number, number];

export interface DetailRow {
  label: string;
  value: string;
}

/** One drawable location for the active mode at the active time slice. */
export interface MapFeature {
  id: string;
  name: string;
  position: [longitude: number, latitude: number];
  color: Rgba;
  /** Screen radius in pixels. */
  radius: number;
  /** 0–1 extrusion value for 3D columns; 0 or undefined draws a flat point. */
  elevation?: number;
  /** Short class label shown in tooltips and the ranked list. */
  classLabel: string;
  /** Distinguishes facility points from area summaries in modes that draw both. */
  kind?: "area" | "facility";
  /** Sort key for the ranked list (higher first). */
  rank: number;
  rows: DetailRow[];
}

/** A spatial relationship drawn between two features. */
export interface MapLink {
  id: string;
  from: [number, number];
  to: [number, number];
  color: Rgba;
}

export interface NationalIndicator {
  title: string;
  value: string;
  period: string;
  rows: DetailRow[];
}

export interface ModeFrame {
  features: MapFeature[];
  links: MapLink[];
  /** Mode has no spatial layer at this resolution; show a national readout instead. */
  national?: NationalIndicator;
  /** Weighted points for a density heatmap (e.g. aggregated search demand). */
  heat?: Array<{ position: [number, number]; weight: number }>;
  /** Sequential color range for `heat`, low → high. */
  heatColors?: Rgba[];
  /**
   * Area fills for categorical signal states only, never for counts. The
   * GeoJSON is loaded from `url`; each feature's `id` keys into `fills`.
   */
  areas?: { url: string; fills: Record<string, Rgba> };
}

export interface TimelineSlice {
  /** ISO date or step key. */
  key: string;
  label: string;
  /** Short label for the track ends. */
  shortLabel: string;
  value: number;
  /** True when the previous slice is not contiguous (a gap in the record). */
  gapBefore: boolean;
}

export interface TimelineSpec {
  slices: TimelineSlice[];
  /** What the scrubber's bars mean, e.g. "Signals reported per day". */
  trackLabel: string;
  /** How one slice maps to the map, e.g. "Signals in the 7 days up to the selected date". */
  interpretation: string;
  formatValue: (value: number) => string;
}

export type LegendClassification =
  | "categorical"
  | "threshold"
  | "linear"
  | "quantile"
  | "zscore"
  | "none";

export interface LegendClass {
  label: string;
  color: string;
  /** Optional numeric range text, e.g. "≥ 2.0". */
  range?: string;
}

export interface LegendSpec {
  title: string;
  metric: string;
  classification: LegendClassification;
  classes?: LegendClass[];
  ramp?: { colors: string[]; minLabel: string; maxLabel: string };
  size?: { label: string; minLabel: string; maxLabel: string };
  height?: { label: string };
  opacity?: { label: string };
  note?: string;
}

export type FilterKey =
  | "disease"
  | "geography"
  | "status"
  | "confidence"
  | "window"
  | "medicine"
  | "accessMetric"
  | "sigmaLayer"
  | "envVariable"
  | "envSource";

export interface MapFilters {
  disease: string;
  geography: string;
  status: string;
  confidence: string;
  /** Trailing window in days, or "all". */
  window: string;
  /** ACCESS: selected medicine id. */
  medicine: string;
  /** ACCESS: which indicator the map encodes. */
  accessMetric: "availability" | "demand" | "freshness" | "gap";
  /** SIGMA: which result the map encodes. */
  sigmaLayer: SigmaLayer;
  /** ENVIRONMENT: which weather variable the map encodes. */
  envVariable: WeatherVariable;
  /** ENVIRONMENT: one source at a time; the two are never spliced on the map. */
  envSource: WeatherSourceId;
}

export type SigmaLayer = "ears" | "doh" | "cases";

export type LayerToggleId = "links" | "columns" | "areas";

export interface MapLayerToggles {
  links: boolean;
  columns: boolean;
  areas: boolean;
}

export type NationalWeeklyPoint = Pick<HealthObservation, "periodStart" | "periodEnd" | "value">;

/**
 * Everything the modes read. Assembled on the server so raw datasets never
 * reach the client bundle; only these small derived arrays are serialized.
 */
export interface MapDataBundle {
  signals: Signal[];
  lgus: LGU[];
  /** Demo observed-vs-expected series per LGU id (signal index basis). */
  trends: Record<string, TrendPoint[]>;
  neighbors: Record<string, NeighborSummary[]>;
  /** Formal national observations (OpenDengue), weekly rows only, trimmed to what the map draws. */
  nationalWeekly: NationalWeeklyPoint[];
  scenario: SimulationInputs;
  /** ACCESS demo bundle (aggregated on the server). */
  access: AccessBundle;
  /** SIGMA reporting-unit results; fetched on the client when the mode opens. */
  sigma?: SigmaData;
  /** Why `sigma` could not be loaded, if it failed. */
  sigmaError?: string;
  /** Weekly city weather; imported on the client when the mode opens. */
  environment?: EnvironmentBundle;
  /** Why `environment` could not be loaded, if it failed. */
  environmentError?: string;
}

export interface PreparedMode {
  timeline: TimelineSpec;
  legend: LegendSpec;
  frameAt: (index: number, toggles: MapLayerToggles) => ModeFrame;
}

export interface MapModeDefinition {
  id: MapModeId;
  label: string;
  /** The analyst question this mode answers. */
  question: string;
  availability: ModeAvailability;
  evidence: ModeEvidence;
  /** Shown next to the mode and in the legend footer. */
  evidenceLabel: string;
  extent: MapExtent;
  filters: FilterKey[];
  layerToggles: LayerToggleId[];
  /** Initial layer state for this mode; the user's changes are kept per mode. */
  defaultToggles?: Partial<MapLayerToggles>;
  /** For planned modes: why nothing is drawn. */
  unavailableReason?: string;
  prepare?: (bundle: MapDataBundle, filters: MapFilters) => PreparedMode;
}
