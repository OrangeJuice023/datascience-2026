/**
 * SIGMA data contracts.
 *
 * These describe records as the data layer serves them, independent of where
 * they are stored (demo modules today, Supabase later). Each contract maps to
 * a table in docs/supabase-schema.md (camelCase here, snake_case there).
 *
 * Two rules are enforced by shape:
 * - Formal case counts (HealthObservation) and open-source signals
 *   (PublicHealthSignal) are separate records with independent geographic
 *   resolution. A signal can be pinned to a barangay while the only formal
 *   data for the same disease is national.
 * - Values derived from signals can never be typed as case counts (see
 *   Measure), and every record carries provenance with an isSample flag.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type SignalStatus = "normal" | "watch" | "elevated";

export type ConfidenceLevel = "low" | "medium" | "high";

export type GeographicLevel =
  | "national"
  | "regional"
  | "provincial"
  | "municipal"
  | "barangay";

export type TemporalResolution = "daily" | "weekly" | "monthly" | "yearly";

/** ISO 8601 calendar date, YYYY-MM-DD. */
export type IsoDate = string;

/** ISO 8601 timestamp with offset, e.g. 2026-09-18T14:30:00Z. */
export type IsoDateTime = string;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type ProvenanceMethod =
  /** Copied from an upstream dataset, normalized but not transformed. */
  | "ingested"
  /** Pulled out of unstructured text such as news or advisories. */
  | "extracted"
  /** Computed from other SIGMA records, e.g. centroid distances. */
  | "derived"
  /** Produced by a statistical or ML model. */
  | "modeled"
  /** Entered or curated by a person. */
  | "manual";

export interface Provenance {
  /** Sources the record came from. Model outputs list their input sources. */
  sourceIds: string[];
  method: ProvenanceMethod;
  /** Job or extractor (and version) that wrote the record. */
  pipeline?: string;
  /** Record identifier in the upstream dataset. */
  upstreamId?: string;
  upstreamUrl?: string;
  /** Upstream release, e.g. a dataset version or PSGC publication. */
  upstreamVersion?: string;
  /** When SIGMA fetched the upstream data. */
  retrievedAt?: IsoDateTime;
  /** When SIGMA wrote this record. */
  recordedAt: IsoDateTime;
  /** DEMO / SAMPLE record. Must never be presented as real data. */
  isSample: boolean;
}

export interface ModelRef {
  name: string;
  version: string;
}

// ---------------------------------------------------------------------------
// Measures: what was counted, and from which kind of evidence
// ---------------------------------------------------------------------------

export type ObservationMetric = "cases" | "deaths" | "incidence_per_100k";

/** Signal metrics describe open-source activity. They are not case counts. */
export type SignalMetric =
  /** Count of signals or documents per period. */
  | "signal_count"
  /** Unitless composite intensity of open-source signals. */
  | "signal_index";

export type EvidenceBasis = "health_observations" | "public_health_signals";

/**
 * Pairs a metric with the evidence it was computed from, so a series built
 * from news signals cannot claim to be a case count.
 */
export type Measure =
  | { basis: "health_observations"; metric: ObservationMetric }
  | { basis: "public_health_signals"; metric: SignalMetric };

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export interface Disease {
  /** Stable slug, e.g. "dengue". */
  id: string;
  name: string;
  /** Alternate names used when matching open-source text. */
  aliases: string[];
  provenance: Provenance;
}

export interface GeographicEntity {
  /** Stable SIGMA id. Opaque: do not parse it. */
  id: string;
  name: string;
  level: GeographicLevel;
  /** Nearest containing entity (levels may be skipped); null for national. */
  parentId: string | null;
  /** PSA PSGC code; null until reconciled against a PSGC publication. */
  psgcCode: string | null;
  /** Representative point for markers and distances. Not a boundary. */
  centroid: GeoPoint | null;
  provenance: Provenance;
}

export type SourceType =
  | "formal_surveillance"
  | "government_release"
  | "lgu_release"
  | "news"
  | "news_aggregator"
  | "geographic_reference"
  | "environmental"
  | "sigma_internal"
  | "other";

export type AccessMethod = "api" | "rss" | "bulk_download" | "manual" | "internal";

export type SourceStatus = "planned" | "active" | "retired";

export interface Source {
  /** Stable slug, e.g. "opendengue". */
  id: string;
  name: string;
  type: SourceType;
  url: string | null;
  accessMethod: AccessMethod;
  /** License as published by the source; null until verified. */
  license: string | null;
  /** Attribution the source requires; null until verified. */
  attribution: string | null;
  /** Resolutions the source is verified to provide; empty until verified. */
  geographicLevels: GeographicLevel[];
  temporalResolution: TemporalResolution | null;
  status: SourceStatus;
  /** When license and resolution were last checked against the source. */
  metadataVerifiedAt: IsoDate | null;
  isSample: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// 1. Formal / historical health data
// ---------------------------------------------------------------------------

export type CaseDefinition =
  | "suspected"
  | "probable"
  | "confirmed"
  | "total"
  | "unspecified";

/** A formal count or rate for one disease × geography × period. */
export interface HealthObservation {
  id: string;
  diseaseId: string;
  geographyId: string;
  /** Resolution of this observation; always equals the geography's level. */
  geographicLevel: GeographicLevel;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  temporalResolution: TemporalResolution;
  metric: ObservationMetric;
  caseDefinition: CaseDefinition;
  value: number;
  provenance: Provenance;
}

// ---------------------------------------------------------------------------
// 2. Open-source public-health signals
// ---------------------------------------------------------------------------

export type SignalEventType =
  | "case_report"
  | "outbreak_declaration"
  | "health_advisory"
  | "facility_strain"
  | "death_report"
  | "other";

export type VerificationStatus =
  | "unverified"
  /** Reported by several independent sources. */
  | "corroborated"
  /** Reported by an official body. SIGMA itself confirms nothing. */
  | "official_report"
  /** Reviewed and found unrelated or unreliable. */
  | "discounted";

/**
 * An event reported in one or more open-source documents. Its location is
 * resolved on its own and is independent of any formal-data resolution.
 */
export interface PublicHealthSignal {
  id: string;
  /** Null when the text does not map to a tracked disease. */
  diseaseId: string | null;
  eventType: SignalEventType;
  title: string;
  /** Place as written in the source text, before geocoding. */
  locationText: string | null;
  /** Administrative unit the location resolved to; null if unresolved. */
  geographyId: string | null;
  geographicLevel: GeographicLevel | null;
  /** Exact point when the text names a specific place, e.g. a facility. */
  point: GeoPoint | null;
  /** When the event happened according to the text; null if not stated. */
  eventDate: IsoDate | null;
  firstReportedAt: IsoDateTime;
  lastReportedAt: IsoDateTime;
  /** Number of linked SignalSource documents. */
  sourceCount: number;
  confidence: ConfidenceLevel;
  verificationStatus: VerificationStatus;
  provenance: Provenance;
}

/** One document that supports a signal. */
export interface SignalSource {
  id: string;
  signalId: string;
  /** Channel SIGMA ingested the document from. */
  sourceId: string;
  /** Outlet or agency that published it; can differ from the channel. */
  publisher: string | null;
  documentUrl: string | null;
  documentTitle: string;
  /** Short evidence excerpt. Store excerpts, not full article text. */
  excerpt: string | null;
  publishedAt: IsoDateTime;
  retrievedAt: IsoDateTime;
  /** How strongly this document supports the signal. */
  confidence: ConfidenceLevel;
  isSample: boolean;
}

// ---------------------------------------------------------------------------
// 3. Model outputs
// ---------------------------------------------------------------------------

/** One period of a disease × geography series. Provenance is on the TrendSeries. */
export interface TrendPoint {
  /** Period start. */
  date: IsoDate;
  observed: number;
  expected: number;
  lowerBound: number;
  upperBound: number;
}

export type TrendSeries = Measure & {
  /** Stable id derived from disease, geography and basis. */
  id: string;
  diseaseId: string;
  geographyId: string;
  geographicLevel: GeographicLevel;
  temporalResolution: TemporalResolution;
  /** Model that produced expected / lowerBound / upperBound. */
  baselineModel: ModelRef;
  /** Ascending by date. */
  points: TrendPoint[];
  provenance: Provenance;
};

type ModelOutputBase = Measure & {
  id: string;
  diseaseId: string;
  geographyId: string;
  geographicLevel: GeographicLevel;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  temporalResolution: TemporalResolution;
  model: ModelRef;
  /** Groups outputs written by one model run. */
  runId: string;
  provenance: Provenance;
};

export type AnomalyResult = ModelOutputBase & {
  outputType: "anomaly";
  observed: number;
  expected: number;
  lowerBound: number;
  upperBound: number;
  /** Deviation from expected; the scale depends on the method. */
  score: number;
  status: SignalStatus;
  /** Percent change vs the previous period; null without a previous period. */
  changePercent: number | null;
};

export type ForecastResult = ModelOutputBase & {
  outputType: "forecast";
  /** Forecast origin: when the forecast was made. */
  issuedAt: IsoDateTime;
  /** Periods between the last observed period and the target period. */
  horizonPeriods: number;
  /** Point forecast. */
  expected: number;
  lowerBound: number;
  upperBound: number;
  /** Nominal coverage of [lowerBound, upperBound], e.g. 0.9. */
  intervalLevel: number;
};

export type SpatialRelationshipType = "adjacent" | "nearest_neighbor" | "mobility";

export interface SpatialRelationship {
  id: string;
  fromGeographyId: string;
  toGeographyId: string;
  /** Both ends share this level; containment uses GeographicEntity.parentId. */
  geographicLevel: GeographicLevel;
  type: SpatialRelationshipType;
  /** Strength in [0, 1]; its meaning depends on the method. */
  weight: number;
  distanceKm: number | null;
  /** e.g. "centroid-knn-k8", "polygon-queen-contiguity". */
  method: string;
  provenance: Provenance;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export interface SimulationParameters {
  /** 0–1: how strongly activity spreads to neighboring areas. */
  spatialCoupling: number;
  /** 0–1 */
  persistence: number;
  /** Day index at which an assumed intervention begins. */
  interventionDay: number;
  /** 0–1: starting intensity. */
  intensity: number;
}

/**
 * A saved scenario definition. Scenario outputs are illustrative and must
 * never be stored or presented as forecasts.
 */
export interface SimulationScenario {
  id: string;
  label: string;
  diseaseId: string;
  originGeographyId: string;
  originGeographicLevel: GeographicLevel;
  horizonDays: number;
  parameters: SimulationParameters;
  provenance: Provenance;
}

// ---------------------------------------------------------------------------
// 4. Environmental covariates (context, never a health measure)
// ---------------------------------------------------------------------------

/**
 * Weather sources. CCHAIN is primary for modeling (12 cities, to 2022);
 * Open-Meteo (ERA5) extends coverage past 2022 and to LGUs outside CCHAIN.
 * Their rainfall comes from different products (CHIRPS vs ERA5), so values
 * from different sources must not be merged into one series.
 */
export type WeatherSourceId = "cchain" | "open_meteo";

export type WeatherVariable =
  /** Total over the week, mm. */
  | "precipitation_mm"
  | "temperature_mean_c"
  /** Mean of daily minima, °C. */
  | "temperature_min_c"
  /** Mean of daily maxima, °C. */
  | "temperature_max_c"
  | "humidity_mean_pct";

export type WeatherQcFlag =
  /** Fewer than 7 days of data; weekly values are left empty. */
  | "incomplete_week"
  | "range_check_failed"
  /** Rainfall missing for part of the city (CHIRPS is land-only). */
  | "rain_partial_area"
  /** ERA5T preliminary values, revised by ECMWF after about 2–3 months. */
  | "provisional_era5t";

/** How substitutable Open-Meteo is for CCHAIN, from the overlap comparison. */
export type WeatherComparability =
  | "raw_interchangeable"
  | "anomaly_interchangeable"
  | "not_interchangeable";

/**
 * Weekly weather for one geography × week × source (hub ENVIRONMENT row).
 * Weeks run Sunday–Saturday, the same convention as HealthObservation.
 */
export interface EnvironmentalObservation {
  id: string;
  /** Canonical geography id, e.g. "davao-city" (data/reference/geo/geography_hub_rows.csv). */
  geographyId: string;
  geographicLevel: GeographicLevel;
  /** Sunday. */
  periodStart: IsoDate;
  /** Saturday. */
  periodEnd: IsoDate;
  /** MMWR epi year and week. */
  epiYear: number;
  epiWeek: number;
  temporalResolution: "weekly";
  sourceId: WeatherSourceId;
  /** Null where the week is incomplete; never zero-filled. */
  values: Record<WeatherVariable, number | null>;
  /** Days with every variable present, 0–7. */
  daysObserved: number;
  qcFlags: WeatherQcFlag[];
  confidence: ConfidenceLevel;
  provenance: Provenance;
}

/** What one source covers for one geography. */
export type HdxUnitRelation = "same_area" | "inside_unit";

export interface WeatherCoverage {
  geographyId: string;
  geographyName: string;
  centroid: GeoPoint;
  /** True when the geography is one of the CCHAIN cities. */
  inCchain: boolean;
  /** PSA PSGC 10-digit code. */
  psgcCode: string;
  /** HDX DOH-Epi reporting unit containing this geography (SIGMA map id). */
  hdxUnitId: string;
  /**
   * same_area: the HDX unit is this city, so its counts can sit next to this weather.
   * inside_unit: the city is part of a larger unit; never join this weather to that unit's counts.
   */
  hdxUnitRelation: HdxUnitRelation;
  sourceId: WeatherSourceId;
  upstreamProduct: string;
  /** e.g. population-weighted barangay mean vs a single grid cell. */
  aggregationMethod: string;
  coverageStart: IsoDate;
  coverageEnd: IsoDate;
  weeks: number;
  /** Weeks with all variables present. */
  completeWeeks: number;
  qcFlagCounts: Partial<Record<WeatherQcFlag, number>>;
  /** Overlap verdict per variable; applies to open_meteo rows. */
  comparability: Record<WeatherVariable, WeatherComparability>;
}
