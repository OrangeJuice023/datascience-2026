/**
 * SIGMA API contracts.
 *
 * Types-only on purpose: both `web/` (Next.js) and `mobile/` (Expo) import
 * these with `import type`, so the compiler erases them and neither bundler
 * ever has to resolve this package at runtime. That keeps the shared contract
 * honest without coupling the two builds together.
 *
 * Rules encoded here:
 * - Every response carries provenance: source, coverage period, geographic
 *   granularity and demo/live status.
 * - "Unavailable" and "not connected" are distinct, explicit states. An empty
 *   array never means "zero cases" and never means "no outbreak".
 * - Nothing in these contracts describes AI output as a verified position.
 */

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

export type ApiVersion = "v1";

/**
 * Status of the data behind a response.
 * - `live`      real records from a connected source
 * - `demo`      simulated / prototype records
 * - `unavailable` the capability exists but no data is present right now
 * - `not_connected` the capability has not been wired to a source yet
 */
export type DataStatus = "live" | "demo" | "unavailable" | "not_connected";

export interface ApiMeta {
  apiVersion: ApiVersion;
  /** ISO-8601 timestamp of when this response was produced. */
  generatedAt: string;
  /** Status of the data in this response. */
  status: DataStatus;
  /** True when the records are simulated rather than observed. */
  isSample: boolean;
}

export interface ApiSuccess<T> {
  data: T;
  meta: ApiMeta;
}

export type ApiErrorCode =
  | "bad_request"
  | "not_found"
  | "method_not_allowed"
  | "payload_too_large"
  | "rate_limited"
  /** The capability exists but no data is present right now. */
  | "unavailable"
  | "not_configured"
  | "upstream_unavailable"
  | "internal_error";

export interface ApiErrorBody {
  code: ApiErrorCode;
  /** Safe, client-facing message. Never an internal exception or stack. */
  message: string;
  /** Field-level detail, e.g. invalid query parameters. */
  details?: Record<string, string[]>;
  /** Seconds to wait, for `rate_limited`. */
  retryAfterSeconds?: number;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
  meta: ApiMeta;
}

// ---------------------------------------------------------------------------
// Source & coverage metadata
// ---------------------------------------------------------------------------

export type EvidenceKind = "formal" | "signal" | "context" | "geography" | "model";

export type SourceStatus = "connected" | "demo" | "planned";

export interface ApiSource {
  id: string;
  name: string;
  status: SourceStatus;
  evidence: EvidenceKind;
  purpose: string;
  /** What the source can and cannot tell you, in one line. */
  scope: string;
  coverage: {
    from: string | null;
    to: string | null;
    geographicLevel: string;
    resolution: string;
  };
  provenance: string;
  accessMethod: string;
  /** Licence as recorded at retrieval; null when not verified. */
  licence: string | null;
  /** Credit line to show wherever the data is displayed. */
  attribution: string;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthService {
  id: string;
  name: string;
  status: "ok" | "degraded" | "disabled";
  /** Whether the service can answer requests at all. */
  enabled: boolean;
  /** Why it is disabled or degraded, in plain language. */
  note: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  version: string;
  /** Configuration flags only. No environment values, no credentials. */
  configuration: {
    /** A model provider key is configured server-side (true/false only). */
    aiProviderConfigured: boolean;
    /** The copilot will accept requests: a key is configured and it is not switched off. */
    chatEnabled: boolean;
    /** Map tiles are configured (true/false only). */
    mapTilesConfigured: boolean;
  };
  services: HealthService[];
  dataSources: { connected: number; demo: number; planned: number };
}

// ---------------------------------------------------------------------------
// Dengue
// ---------------------------------------------------------------------------

export type GeographicLevel = "national" | "regional" | "provincial" | "municipal" | "barangay";

export interface ObservationRecord {
  id: string;
  diseaseId: string;
  geographyId: string;
  geographicLevel: GeographicLevel;
  periodStart: string;
  periodEnd: string;
  temporalResolution: "daily" | "weekly" | "monthly" | "yearly";
  metric: string;
  caseDefinition: string;
  value: number;
}

export interface DengueSeriesMeta {
  source: ApiSource;
  /** Inclusive ISO dates of the whole series, not of the returned slice. */
  coverage: { from: string; to: string; weeks: number; recordedWeeks: number };
  /** Weeks present in the source but absent from the record. Never zero-filled. */
  gaps: { from: string; to: string; missingWeeks: number }[];
  geographicLevel: GeographicLevel;
  geographicScope: string;
  /** Human statement of what this series is and is not. */
  interpretation: string;
  limitations: string[];
}

export interface DengueObservationsData {
  series: DengueSeriesMeta;
  observations: ObservationRecord[];
  /** Present when the response was truncated by a limit. */
  truncated: boolean;
}

export interface DengueSummaryPoint {
  periodStart: string;
  periodEnd: string;
  /** Null marks a week with no record in the source. */
  value: number | null;
  epiYear: number;
  epiWeek: number;
}

export interface DengueEpiYear {
  year: number;
  recordedWeeks: number;
  expectedWeeks: number;
  complete: boolean;
  truncated: boolean;
  recordedSum: number;
}

export interface DengueSummaryData {
  series: DengueSeriesMeta;
  weekly: {
    points: DengueSummaryPoint[];
    recorded: number;
    expected: number;
    first: string | null;
    last: string | null;
    stats: {
      mean: number;
      median: number;
      min: { value: number; periodStart: string };
      max: { value: number; periodStart: string };
    } | null;
    epiYears: DengueEpiYear[];
  };
  yearly: { periodStart: string; periodEnd: string; value: number }[];
  monthly: { periodStart: string; periodEnd: string; value: number }[];
  caseDefinitions: string[];
}

/**
 * Computed anomaly / signal output. Never populated by a placeholder.
 */
export interface DengueSignalRecord {
  id: string;
  geographyId: string;
  periodStart: string;
  periodEnd: string;
  method: string;
  value: number;
  threshold: number;
  alarm: boolean;
}

export interface DengueSignalsData {
  /** `not_connected` until a model is fitted and wired to a provider. */
  status: "not_connected" | "unavailable" | "live";
  /** Explains the status in plain language. */
  reason: string;
  /** Which engine would produce these results. */
  engine: {
    id: string;
    name: string;
    /** Where the implementation lives and whether it has been run. */
    location: string;
    status: "not_connected" | "connected";
    method: string;
    dataWindow: string;
    geographicScope: string;
  };
  /** Empty while not connected. Never interpreted as "no signal". */
  signals: DengueSignalRecord[];
  limitations: string[];
}

/**
 * One HDX dengue reporting unit and one MMWR epi year, from the SIGMA export
 * (ml/export_sigma_web.py). Usable weeks only: a missing or suspect week adds
 * no cases and is never read as zero.
 */
export interface DengueUnitYear {
  /** MMWR epi year (the year holding the week's Wednesday). */
  year: number;
  /** Reported cases summed over usable weeks; null when the year has none. Not an annual total unless `usableWeeks` equals `weeks`. */
  cases: number | null;
  usableWeeks: number;
  /** Weeks of this epi year in the export. */
  weeks: number;
  /** Usable weeks with an EARS C1, C2 or C3 alarm; null when no week of the year had an EARS result. */
  earsWeeks: number | null;
  /** Usable weeks with an EARS result (alarm or none). */
  earsEvaluatedWeeks: number;
  /** Usable weeks above the DOH alert or epidemic threshold; null when no week could be compared (thresholds start in 2019). */
  dohWeeks: number | null;
  /** Usable weeks compared with a DOH threshold. */
  dohEvaluatedWeeks: number;
}

export interface DengueUnitRecord {
  /** HDX dengue reporting-unit id, the same id the SIGMA map and ACCESS use. */
  id: string;
  name: string;
  unitType: string;
  regionId: string;
  years: DengueUnitYear[];
}

export interface DengueUnitsData {
  units: DengueUnitRecord[];
  scope: {
    source: string;
    period: { from: string; to: string; weeks: number; epiYears: number[] };
    /** Units in this response. */
    units: number;
    notes: string[];
  };
}

// ---------------------------------------------------------------------------
// ACCESS
// ---------------------------------------------------------------------------

export type AccessGapLevel = "low" | "moderate" | "elevated" | "insufficient_data";
export type AccessConfidence = "low" | "medium" | "high";

export interface AccessArea {
  id: string;
  name: string;
  province: string;
  region: string;
  /** Null when the area's location is unknown; never 0,0. */
  latitude: number | null;
  longitude: number | null;
  facilityCount: number;
}

export interface AccessMedicine {
  id: string;
  name: string;
  category: string;
  isSample: boolean;
}

export interface AccessMetricRecord {
  medicineId: string;
  medicineName: string;
  areaId: string;
  areaName: string;
  psgcCode: string | null;
  periodStart: string;
  periodEnd: string;
  searchDemand: number;
  notFoundSearches: number;
  demandRatio: number;
  facilities: number;
  confirmedAvailable: number;
  reportedUnavailable: number;
  staleInventory: number;
  unknownInventory: number;
  facilityCoverage: number;
  accessGap: AccessGapLevel;
  accessGapLabel: string;
  confidence: AccessConfidence;
  reasons: string[];
  isSample: boolean;
}

export interface AccessMetricsData {
  scope: {
    /** Always explicit. */
    isSample: boolean;
    source: string;
    sourceNote: string;
    areas: number;
    facilities: number;
    medicines: number;
    weeks: number;
    /** Null when there are no weeks. */
    coverage: { from: string | null; to: string | null };
    /** What the data can and cannot support. */
    supports: string[];
    doesNotSupport: string[];
  };
  medicines: AccessMedicine[];
  areas: AccessArea[];
  weeks: { index: number; periodStart: string; periodEnd: string }[];
  metrics: AccessMetricRecord[];
  /** Areas for human review, derived from the latest week. */
  areasForAssessment: AccessAssessmentRecord[];
}

export interface AccessAssessmentRecord {
  areaId: string;
  areaName: string;
  medicineId: string;
  medicineName: string;
  gap: AccessGapLevel;
  gapLabel: string;
  confidence: AccessConfidence;
  observed: string[];
  areaForAssessment: string;
}

// The types above describe GET /access/metrics, which served demo inventory
// and now answers `not_connected` with empty lists. Real ACCESS data is
// served by /access/units and /access/medicines below.

export type AccessFacilityType = "hospital" | "clinic" | "pharmacy" | "laboratory";

export interface AccessSourceRecord {
  id: string;
  title: string;
  publisher: string;
  url: string;
  license: string;
  attribution: string;
  /** Upstream snapshot date or edition, when the source states one. */
  snapshot: string | null;
  edition: string | null;
  sha256: string | null;
}

export interface AccessUnitRecord {
  /** HDX dengue reporting-unit id, the same id the SIGMA map uses. */
  id: string;
  name: string;
  unitType: string;
  regionId: string;
  psgcCode: string | null;
  areaSqKm: number | null;
  /** Facilities mapped in OpenStreetMap; low counts can mean low mapping, not low access. */
  mappedFacilities: Record<AccessFacilityType, number>;
  mappedPer100SqKm: Record<AccessFacilityType, number> | null;
  /** Not in the dataset; never estimated. */
  population: null;
  /** Never reported by any public source; always null. */
  medicineAvailability: null;
  /** No search data exists; always null. */
  searchDemand: null;
  /** Reported dengue cases per year, summed over usable weeks only. */
  dengue: { year: number; reportedCases: number; usableWeeks: number; weeks: number }[] | null;
}

export interface AccessUnitsData {
  scope: {
    question: string;
    units: number;
    facilitiesMapped: number;
    supports: string[];
    doesNotSupport: string[];
    limitations: string[];
  };
  sources: AccessSourceRecord[];
  units: AccessUnitRecord[];
}

export interface AccessMedicinePriceRecord {
  item: string;
  /** "priced", or why there is no price (e.g. hidden in the DOH public view). */
  status: string;
  lowestPhp: number | null;
  medianPhp: number | null;
  highestPhp: number | null;
  /** DOH hospitals with a public procurement row for the item. */
  reportingFacilities: number | null;
}

export interface AccessMedicineRecord {
  id: string;
  name: string;
  role: string;
  onPnfEml: boolean;
  pnfPage: string | null;
  basis: string;
  prices: AccessMedicinePriceRecord[];
}

export interface AccessMedicinesData {
  scope: {
    /** What the prices are: DOH hospital procurement, not shelf prices or stock. */
    priceBasis: string;
    doesNotSupport: string[];
  };
  sources: AccessSourceRecord[];
  medicines: AccessMedicineRecord[];
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export interface PolicyInfoData {
  scope: {
    isSample: boolean;
    source: string;
    sourceNote: string;
    /** AI output is never a verified government position. */
    aiDisclosure: string;
  };
  /** Counted from the policy evidence registry, one line per point. */
  evidenceSummary: string[];
  whatSigmaDoesNot: string[];
  supportedDiseases: string[];
  /**
   * Which diseases SIGI can answer about, and for which reporting units. A
   * client uses this to offer only combinations that will actually succeed,
   * instead of letting the user pick one that will fail.
   */
  chatScope: { disease: string; locationIds: string[] }[];
  /** The 126 HDX dengue reporting units, and whether any local policy record names each one. */
  areas: { id: string; name: string; unitType: string; region: string; hasLocalPolicy: boolean }[];
  sources: ApiSource[];
  limitations: string[];
}

// ---------------------------------------------------------------------------
// Chat (Policy Copilot)
// ---------------------------------------------------------------------------

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /**
   * Assistant turns only: the `replySignature` the server returned with this
   * reply. The server rejects an assistant turn without a valid signature, so
   * a client cannot put words in the model's mouth or carry a conversation
   * into another disease or LGU.
   */
  signature?: string;
}

export interface ChatRequestBody {
  message: string;
  history?: ChatMessage[];
  disease?: string;
  locationId?: string;
  /** Optional second reporting unit to compare with; its evidence is kept separate. */
  compareLocationId?: string;
}

export interface ChatResponseData {
  reply: string;
  model: string;
  /** What the model was given, described in one line. */
  contextScope: string;
  limitations: string[];
  /** Send back as the `signature` of this reply when it is part of a later request's history. */
  replySignature: string;
  /**
   * The evidence items the reply cites, as the server found them among the
   * items the model was given, in order of first citation. An id the model
   * made up never appears here.
   */
  citations: ChatCitation[];
  /**
   * Evidence ids the reply named that SIGI was not given (for example another
   * city's records). They are never shown as sources; the client marks that
   * part of the answer as unsupported.
   */
  rejectedCitationIds: string[];
}

export interface ChatCitation {
  id: string;
  kind: "lab" | "access" | "policy" | "method";
  jurisdiction: "reporting unit" | "local" | "national" | "method";
  /** The reporting unit the item is about; null for national and method items. */
  unitId: string | null;
  title: string;
  source: { name: string; url: string | null };
  /** In-app page showing the same evidence. */
  href: string | null;
}

// ---------------------------------------------------------------------------
// Sigi (the mascot)
// ---------------------------------------------------------------------------

/**
 * The states of Sigi, the SIGMA companion.
 *
 * These are interface states, not data states: each one says what the client
 * is doing right now (waiting, thinking, showing a result), never what the
 * data means. A mascot animation must never be the thing that tells a reader
 * that an outbreak is happening, so no state name describes an epidemiological
 * condition.
 */
export type SigiState =
  | "idle"
  | "greeting"
  | "listening"
  | "thinking"
  | "responding"
  | "insight"
  | "unavailable"
  | "error"
  | "success"
  | "sleepy";

