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
  /** Separate, clearly-labelled open-source signal demo data. */
  openSourceSignals: {
    isSample: true;
    records: DemoSignalRecord[];
    note: string;
  };
  limitations: string[];
}

export interface DemoSignalRecord {
  id: string;
  disease: string;
  locationId: string;
  locationName: string;
  date: string;
  signalLevel: number;
  sourceCount: number;
  confidence: "low" | "medium" | "high";
  changePercent: number;
  status: "normal" | "watch" | "elevated";
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
  latitude: number;
  longitude: number;
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
    coverage: { from: string; to: string };
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

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export interface PolicyInsightRecord {
  category: string;
  title: string;
  rationale: string;
  evidenceType: string;
  assessmentStatus: "for-assessment" | "monitoring";
}

export interface PolicyInfoData {
  scope: {
    isSample: boolean;
    source: string;
    sourceNote: string;
    /** AI output is never a verified government position. */
    aiDisclosure: string;
  };
  evidenceSummary: string[];
  areasForAssessment: PolicyInsightRecord[];
  whatSigmaDoesNot: string[];
  supportedDiseases: string[];
  /**
   * Which diseases the copilot can answer about, and which locations it has
   * data for. A client uses this to offer only combinations that will
   * actually succeed, instead of letting the user pick one that will fail.
   */
  chatScope: { disease: string; locationIds: string[] }[];
  areas: { id: string; name: string; province: string; region: string }[];
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
}

export interface ChatRequestBody {
  message: string;
  history?: ChatMessage[];
  disease?: string;
  locationId?: string;
}

export interface ChatResponseData {
  reply: string;
  model: string;
  /** What the model was given, described in one line. */
  contextScope: string;
  limitations: string[];
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

