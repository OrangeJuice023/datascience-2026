import type { ApiErrorCode, DataStatus } from "@sigma/contracts";

export type { DataStatus };

/**
 * The API registry.
 *
 * One list of endpoints, used by three things:
 *
 * 1. `GET /api/v1`, the machine-readable index.
 * 2. The `/documentation` page.
 * 3. The registry test, which checks this list against the route files on
 *    disk and against the real handler responses.
 *
 * The point of having one list is that the documentation cannot quietly fall
 * behind the API. If a route is added, renamed or given a different
 * parameter, the test fails until this file is updated to match.
 *
 * Everything in here is verified against the handlers:
 *
 * - `status` and `isSample` are the values the real handler returns.
 * - `parameters` are the parameters the handler actually accepts; every
 *   endpoint rejects unknown parameters, so the list is exhaustive.
 * - `exampleResponse` is a trimmed but real response body.
 *
 * Nothing here is aspirational. If the API does not do it, it is not written
 * down.
 */

/** The deployment the public examples call. */
export const PUBLIC_API_BASE_URL = "https://datascience-2026.vercel.app/api/v1";

/** The same API, relative to whatever origin serves this app. */
export const RELATIVE_API_BASE_URL = "/api/v1";

export type HttpMethod = "GET" | "POST";

export type EndpointGroup = "Reference" | "Service" | "Surveillance" | "Access" | "Policy";

export interface EndpointParameter {
  name: string;
  type: "string" | "integer" | "date" | "body";
  required: boolean;
  /** The value used when the parameter is omitted. */
  default?: string;
  /** The complete set of accepted values, when the parameter is an enum. */
  allowed?: readonly string[];
  notes: string;
}

export interface EndpointError {
  status: number;
  code: ApiErrorCode;
  when: string;
}

export interface EndpointExample {
  /** Query string including the leading "?", or "" when there is none. */
  query: string;
  /** Request body, for the endpoints that take one. */
  body?: Record<string, unknown>;
}

export interface DataTypeRef {
  /** The TypeScript type of the `data` payload. */
  name: string;
  /** The module it comes from, or null when it is not in a shared package. */
  from: string | null;
}

export interface ApiEndpoint {
  method: HttpMethod;
  /** The path below the version root, e.g. "/dengue/summary". */
  path: string;
  /**
   * Whether the endpoint appears in the `GET /api/v1` index. The index does
   * not list itself.
   */
  listedInIndex: boolean;
  group: EndpointGroup;
  title: string;
  /** One line, used in the index and the page's summary table. */
  summary: string;
  /** What the endpoint is for and what a caller can do with it. */
  description: string;
  parameters: EndpointParameter[];
  /** The `data` payload, one line per top-level key. */
  responseShape: string[];
  /** The `meta.status` the endpoint returns on a successful response today. */
  status: DataStatus;
  /** Every status the endpoint can return in a success envelope. */
  possibleStatuses: DataStatus[];
  /** Whether `meta.isSample` is true on a successful response. */
  isSample: boolean;
  /** What a caller has to do to make the request, if anything. */
  auth: string;
  dataType: DataTypeRef;
  example: EndpointExample;
  /** A trimmed, real response body. */
  exampleResponse: unknown;
  /** True when `exampleResponse` is a subset rather than the whole body. */
  exampleIsTrimmed: boolean;
  errors: EndpointError[];
  notes: string[];
}

const NO_AUTH = "No authentication. No API key, token or session is read or required.";

const CHAT_AUTH =
  "No authentication on the request itself. The endpoint is rate limited to 30 requests per 60 seconds per IP address, and it needs a model provider configured on the server; without one it answers 503 not_configured rather than returning a placeholder.";

const BAD_REQUEST = (what: string): EndpointError => ({
  status: 400,
  code: "bad_request",
  when: what,
});

const UNKNOWN_PARAM: EndpointError = BAD_REQUEST(
  "The endpoint is given a query parameter it does not accept. Unknown parameters are rejected rather than ignored.",
);

const SERVER_ERROR: EndpointError = {
  status: 500,
  code: "internal_error",
  when: "An unexpected failure inside the handler. The message is deliberately generic.",
};

const UNAVAILABLE_ENVELOPE =
  "Every failed response carries the same error envelope, and `meta.status` is \"unavailable\" on it — including failures that are really client errors.";

export { UNAVAILABLE_ENVELOPE };

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: "GET",
    path: "/",
    listedInIndex: false,
    group: "Reference",
    title: "Endpoint index",
    summary: "The list of endpoints this API serves.",
    description:
      "A machine-readable index of the API surface. It is the quickest way for a client to discover what exists, and it is generated from the same registry that renders this page, so the two cannot disagree.",
    parameters: [],
    responseShape: [
      "service — always \"sigma-api\"",
      "apiVersion — the API version this index describes",
      "endpoints[] — one entry per endpoint: method, path, description",
    ],
    status: "live",
    possibleStatuses: ["live"],
    isSample: false,
    auth: NO_AUTH,
    dataType: { name: "ApiIndexData", from: null },
    example: { query: "" },
    exampleResponse: {
      data: {
        service: "sigma-api",
        apiVersion: "v1",
        endpoints: [
          {
            method: "GET",
            path: "/api/v1/health",
            description: "Service availability and configuration flags.",
          },
          {
            method: "GET",
            path: "/api/v1/sources",
            description: "The source catalogue and what each source can answer.",
          },
        ],
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-21T00:00:00.000Z",
        status: "live",
        isSample: false,
      },
    },
    exampleIsTrimmed: true,
    errors: [UNKNOWN_PARAM, SERVER_ERROR],
    notes: [
      "The `endpoints` array in the response holds every endpoint, not the two shown in the trimmed example above.",
    ],
  },
  {
    method: "GET",
    path: "/health",
    listedInIndex: true,
    group: "Service",
    title: "Health",
    summary: "Service availability and configuration flags.",
    description:
      "Which services can answer, which are disabled, and whether the optional integrations are configured. The configuration block holds booleans only: no environment value, no credential and no key is ever returned.",
    parameters: [],
    responseShape: [
      "status — \"ok\" or \"degraded\" for the service as a whole",
      "service — the service name",
      "version — the service version",
      "configuration.aiProviderConfigured — whether a model provider key exists server-side (boolean)",
      "configuration.chatEnabled — whether the copilot accepts requests: a key exists and CHAT_DISABLED / CHAT_PUBLIC_DISABLED is not set (boolean)",
      "configuration.mapTilesConfigured — whether map tiles are configured (boolean)",
      "services[] — id, name, status, enabled, and a plain-language note",
      "dataSources — connected, demo and planned source counts",
    ],
    status: "live",
    possibleStatuses: ["live"],
    isSample: false,
    auth: NO_AUTH,
    dataType: { name: "HealthResponse", from: "@sigma/contracts" },
    example: { query: "" },
    exampleResponse: {
      data: {
        status: "ok",
        service: "sigma-api",
        version: "0.1.0",
        configuration: {
          aiProviderConfigured: false,
          chatEnabled: false,
          mapTilesConfigured: false,
        },
        services: [
          {
            id: "dengue-observations",
            name: "Dengue historical observations",
            status: "ok",
            enabled: true,
            note: "OpenDengue v1.3 national weekly series, served from a validated build-time fixture.",
          },
          {
            id: "anomaly-engine",
            name: "Anomaly detection (EARS)",
            status: "disabled",
            enabled: false,
            note: "The EARS pipeline exists in the Python data track but is not connected to this API, so no anomaly result is served.",
          },
        ],
        dataSources: {
          connected: 10,
          demo: 2,
          planned: 2,
        },
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-21T00:00:00.000Z",
        status: "live",
        isSample: false,
      },
    },
    exampleIsTrimmed: true,
    errors: [SERVER_ERROR],
    notes: [
      "`configuration` reports whether a key exists, never what it is. There is a test that asserts no response body can contain a key or a secret.",
    ],
  },
  {
    method: "GET",
    path: "/sources",
    listedInIndex: true,
    group: "Service",
    title: "Source catalogue",
    summary: "The source catalogue and what each source can answer.",
    description:
      "Every source SIGMA knows about, with its status, its purpose, its coverage and — in `scope` — one line saying what it cannot tell you. A planned source is reported as `planned`; nothing is reported as connected before it is.",
    parameters: [],
    responseShape: [
      "sources[] — one entry per source",
      "sources[].id, name, status, evidence — identity and whether it is connected, demo or planned",
      "sources[].purpose — what the source is for",
      "sources[].scope — what the source can and cannot answer",
      "sources[].coverage — from, to, geographicLevel, resolution",
      "sources[].provenance, accessMethod — where the data came from and how it is obtained",
    ],
    status: "live",
    possibleStatuses: ["live"],
    isSample: false,
    auth: NO_AUTH,
    dataType: { name: "ApiSource", from: "@sigma/contracts" },
    example: { query: "" },
    exampleResponse: {
      data: {
        sources: [
          {
            id: "opendengue",
            name: "OpenDengue v1.3",
            status: "connected",
            evidence: "formal",
            purpose: "Historical national dengue case counts; the baseline series for ANALYZE.",
            scope:
              "Historical national reported dengue case counts only. Not a forecast, not sub-national, and not a confirmed outbreak statement.",
            coverage: {
              from: "2012-12-30",
              to: "2023-11-25",
              geographicLevel: "national",
              resolution: "National · weekly (544 weeks, Dec 30 2012 – Nov 25 2023, with gaps)",
            },
            provenance:
              "Temporal extract (WPRO), PH Admin0; per-row upstream record ids; input SHA-256; planning/OPENDENGUE_RECONCILIATION.md",
            accessMethod: "Bulk download (release extract), processed at build time",
          },
        ],
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-21T00:00:00.000Z",
        status: "live",
        isSample: false,
      },
    },
    exampleIsTrimmed: true,
    errors: [SERVER_ERROR],
    notes: [
      "A `demo` source is simulated. A `planned` source is not ingested at all: its coverage window is null rather than a guess.",
    ],
  },
  {
    method: "GET",
    path: "/dengue/observations",
    listedInIndex: true,
    group: "Surveillance",
    title: "Dengue observations",
    summary: "Raw weekly national dengue observations. Query: from, to, limit.",
    description:
      "The raw observation records of the national OpenDengue series. Weeks the source does not have are absent from the response: the series is never zero-filled and never interpolated, and the missing runs are listed in `series.gaps`.",
    parameters: [
      {
        name: "disease",
        type: "string",
        required: false,
        default: "dengue",
        allowed: ["dengue"],
        notes: "Only the dengue series is connected. Any other value is a 404.",
      },
      {
        name: "from",
        type: "date",
        required: false,
        notes: "Inclusive ISO date (YYYY-MM-DD). A value that is not a real calendar date is a 400.",
      },
      {
        name: "to",
        type: "date",
        required: false,
        notes: "Inclusive ISO date (YYYY-MM-DD). Must not be earlier than `from`.",
      },
      {
        name: "limit",
        type: "integer",
        required: false,
        default: "2000 (the maximum)",
        notes: "Between 1 and 2000. The response sets `truncated` when the series was cut short.",
      },
    ],
    responseShape: [
      "series — source, coverage, gaps, geographicLevel, geographicScope, interpretation, limitations",
      "observations[] — id, diseaseId, geographyId, geographicLevel, periodStart, periodEnd, temporalResolution, metric, caseDefinition, value",
      "truncated — true when the limit cut the series short",
    ],
    status: "live",
    possibleStatuses: ["live"],
    isSample: false,
    auth: NO_AUTH,
    dataType: { name: "DengueObservationsData", from: "@sigma/contracts" },
    example: { query: "?limit=2" },
    exampleResponse: {
      data: {
        series: {
          source: {
            id: "opendengue",
            name: "OpenDengue 1.3",
            status: "connected",
            evidence: "formal",
            purpose: "Historical national dengue case counts; the baseline series for ANALYZE.",
            scope:
              "National only. Sub-national rows exist in other OpenDengue extracts and are not connected.",
            coverage: {
              from: "2012-12-30",
              to: "2023-11-25",
              geographicLevel: "national",
              resolution: "weekly",
            },
            provenance:
              "Temporal extract (WPRO); filter ISO_A0 = PHL, T_res = Week, S_res = Admin0; Clarke J et al. Sci Data 2024;11:296. doi:10.6084/m9.figshare.24259573; CC BY 4.0",
            accessMethod:
              "Bulk release extract, validated at build time and committed as a frontend fixture",
          },
          coverage: {
            from: "2012-12-30",
            to: "2023-11-25",
            weeks: 569,
            recordedWeeks: 544,
          },
          gaps: [
            {
              from: "2014-12-28",
              to: "2014-12-28",
              missingWeeks: 1,
            },
          ],
          geographicLevel: "national",
          geographicScope:
            "Philippines (national). Sub-national reporting is not connected to this series.",
          interpretation:
            "Historical national (Philippines) reported dengue case counts. Observed surveillance records, not a model output, not a forecast and not a confirmed outbreak statement.",
          limitations: [
            "The series is not continuous: missing weeks are absent, never zero-filled or interpolated.",
          ],
        },
        observations: [
          {
            id: "opendengue-ph-weekly-2012-12-30",
            diseaseId: "dengue",
            geographyId: "ph",
            geographicLevel: "national",
            periodStart: "2012-12-30",
            periodEnd: "2013-01-05",
            temporalResolution: "weekly",
            metric: "cases",
            caseDefinition: "total",
            value: 2101,
          },
        ],
        truncated: true,
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-21T00:00:00.000Z",
        status: "live",
        isSample: false,
      },
    },
    exampleIsTrimmed: true,
    errors: [
      UNKNOWN_PARAM,
      BAD_REQUEST("`limit` is not a whole number, or is outside 1–2000."),
      BAD_REQUEST("`from` or `to` is not an ISO date, or `from` is later than `to`."),
      {
        status: 404,
        code: "not_found",
        when: "`disease` names a series that is not connected.",
      },
      {
        status: 503,
        code: "unavailable",
        when: "The national observation series could not be loaded.",
      },
      SERVER_ERROR,
    ],
    notes: [
      "The coverage window is 2012-12-30 to 2023-11-25: 544 of 569 expected weeks are recorded. The series is connected, so `meta.status` is \"live\", but it describes a period that has already passed.",
    ],
  },
  {
    method: "GET",
    path: "/dengue/summary",
    listedInIndex: true,
    group: "Surveillance",
    title: "Dengue summary",
    summary: "Weekly, monthly and yearly aggregates with gaps and completeness. Query: limit.",
    description:
      "The same national series, aggregated. Weekly, monthly and yearly rows are separate reporting streams and are never summed into one another. A missing week appears as `value: null`, and each epi year states whether every week in it was recorded.",
    parameters: [
      {
        name: "limit",
        type: "integer",
        required: false,
        default: "1200 (the maximum)",
        notes: "Between 1 and 1200. The limit applies to the weekly points.",
      },
    ],
    responseShape: [
      "series — source, coverage, gaps, geographicLevel, geographicScope, interpretation, limitations",
      "weekly.points[] — periodStart, periodEnd, value (null for a week with no record), epiYear, epiWeek",
      "weekly.recorded, expected — how many weeks exist and how many were recorded",
      "weekly.first, last — the first and last week the source contains",
      "weekly.stats — mean, median, min and max of the recorded weeks",
      "weekly.epiYears[] — year, recordedWeeks, expectedWeeks, complete, truncated, recordedSum",
      "yearly[] — periodStart, periodEnd, value",
      "monthly[] — periodStart, periodEnd, value",
      "caseDefinitions[] — the case definitions present in the extract",
    ],
    status: "live",
    possibleStatuses: ["live"],
    isSample: false,
    auth: NO_AUTH,
    dataType: { name: "DengueSummaryData", from: "@sigma/contracts" },
    example: { query: "?limit=2" },
    exampleResponse: {
      data: {
        series: {
          source: {
            id: "opendengue",
            name: "OpenDengue 1.3",
            status: "connected",
            evidence: "formal",
            purpose: "Historical national dengue case counts; the baseline series for ANALYZE.",
            scope:
              "National only. Sub-national rows exist in other OpenDengue extracts and are not connected.",
            coverage: {
              from: "2012-12-30",
              to: "2023-11-25",
              geographicLevel: "national",
              resolution: "weekly",
            },
            provenance:
              "Temporal extract (WPRO); filter ISO_A0 = PHL, T_res = Week, S_res = Admin0; Clarke J et al. Sci Data 2024;11:296. doi:10.6084/m9.figshare.24259573; CC BY 4.0",
            accessMethod:
              "Bulk release extract, validated at build time and committed as a frontend fixture",
          },
          coverage: {
            from: "2012-12-30",
            to: "2023-11-25",
            weeks: 569,
            recordedWeeks: 544,
          },
          gaps: [
            {
              from: "2014-12-28",
              to: "2014-12-28",
              missingWeeks: 1,
            },
          ],
          geographicLevel: "national",
          geographicScope:
            "Philippines (national). Sub-national reporting is not connected to this series.",
          interpretation:
            "Historical national (Philippines) reported dengue case counts. Observed surveillance records, not a model output, not a forecast and not a confirmed outbreak statement.",
          limitations: [
            "The series is not continuous: missing weeks are absent, never zero-filled or interpolated.",
          ],
        },
        weekly: {
          points: [
            {
              periodStart: "2012-12-30",
              periodEnd: "2013-01-05",
              value: 2101,
              epiYear: 2013,
              epiWeek: 1,
            },
            {
              periodStart: "2013-01-06",
              periodEnd: "2013-01-12",
              value: 2862,
              epiYear: 2013,
              epiWeek: 2,
            },
          ],
          recorded: 544,
          expected: 569,
          first: "2012-12-30",
          last: "2023-11-25",
          stats: {
            mean: 3513.551470588235,
            median: 2537.5,
            min: { value: 132, periodStart: "2023-07-02" },
            max: { value: 21743, periodStart: "2019-07-28" },
          },
          epiYears: [
            {
              year: 2013,
              recordedWeeks: 52,
              expectedWeeks: 52,
              complete: true,
              truncated: false,
              recordedSum: 215868,
            },
            {
              year: 2014,
              recordedWeeks: 52,
              expectedWeeks: 53,
              complete: false,
              truncated: false,
              recordedSum: 113801,
            },
          ],
        },
        yearly: [],
        monthly: [],
        caseDefinitions: ["total"],
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-21T00:00:00.000Z",
        status: "live",
        isSample: false,
      },
    },
    exampleIsTrimmed: true,
    errors: [
      UNKNOWN_PARAM,
      BAD_REQUEST("`limit` is not a whole number, or is outside 1–1200."),
      {
        status: 503,
        code: "unavailable",
        when: "The national observation series could not be loaded.",
      },
      SERVER_ERROR,
    ],
    notes: [
      "The `yearly` and `monthly` arrays are empty in the current deployment. Only the weekly stream is populated; the fields are part of the contract and are ready for the other resolutions.",
      "An annual total is meaningful only for an epi year in which every week was recorded. `weekly.epiYears[].complete` says which years those are — 2013, 2019 and 2020 in the current series.",
    ],
  },
  {
    method: "GET",
    path: "/dengue/signals",
    listedInIndex: true,
    group: "Surveillance",
    title: "Dengue signals",
    summary: "Anomaly results (empty until a model is connected) and open-source signal demo data.",
    description:
      "The anomaly block and the open-source signal block, kept apart. The anomaly engine is not wired to this API, so `signals` is empty and `status` is \"not_connected\": an empty list never means \"no outbreak\". The open-source signal records are simulated, and say so.",
    parameters: [
      {
        name: "disease",
        type: "string",
        required: false,
        default: "Dengue",
        notes: "Must be a supported disease. Any other value is a 404.",
      },
      {
        name: "locationId",
        type: "string",
        required: false,
        notes: "Narrows the open-source signal block to one location.",
      },
    ],
    responseShape: [
      "status — \"not_connected\" until a model is wired in, then \"live\"",
      "reason — why the anomaly block is empty, in plain language",
      "engine — id, name, location, status, method, dataWindow, geographicScope",
      "signals[] — the anomaly results; empty while no engine is connected",
      "openSourceSignals.isSample — always true for this block",
      "openSourceSignals.records[] — simulated signal records",
      "openSourceSignals.note — what this block is and is not",
      "limitations[] — what the engine cannot do",
    ],
    status: "not_connected",
    possibleStatuses: ["not_connected", "live"],
    isSample: true,
    auth: NO_AUTH,
    dataType: { name: "DengueSignalsData", from: "@sigma/contracts" },
    example: { query: "" },
    exampleResponse: {
      data: {
        status: "not_connected",
        reason:
          "No anomaly model is connected to this API. The EARS pipeline exists in the Python data track (ml/ears.py) but its outputs are not served here, so no anomaly result is reported. This is not evidence that no outbreak is occurring.",
        engine: {
          id: "ears-cdc",
          name: "CDC EARS C1/C2/C3",
          location: "ml/ears.py (Python), ml/clean_dengue.py, ml/qa/",
          status: "not_connected",
          method:
            "C1: 7-week baseline, C2: 7-week baseline with 2-week lag, C3: sum of max(0, C2-1) over three weeks. Thresholds 3.0 (C1/C2) and 2.0 (C3); minimum 5 of 7 usable baseline weeks; standard deviation floored at 1; minimum 5 cases to alarm.",
          dataWindow: "2016-01-10 to 2021-01-03 (261 weeks)",
          geographicScope: "National plus 126 provinces and cities",
        },
        signals: [],
        openSourceSignals: {
          isSample: true,
          records: [
            {
              id: "sig-01",
              disease: "Dengue",
              locationId: "quezon-city",
              locationName: "Quezon City",
              date: "2026-09-18",
              signalLevel: 2.1,
              sourceCount: 8,
              confidence: "high",
              changePercent: 46,
              status: "elevated",
            },
          ],
          note:
            "Open-source signal demo data. These are illustrative activity indicators derived from simulated sources, not case counts, and not evidence of an outbreak.",
        },
        limitations: [
          "The EARS pipeline is implemented in Python but is not connected to this API.",
        ],
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-21T00:00:00.000Z",
        status: "not_connected",
        isSample: true,
      },
    },
    exampleIsTrimmed: true,
    errors: [
      UNKNOWN_PARAM,
      {
        status: 404,
        code: "not_found",
        when: "`disease` names a disease that is not supported.",
      },
      SERVER_ERROR,
    ],
    notes: [
      "`meta.status` follows the anomaly block, not the signal block: it is \"not_connected\" today because the engine is not wired in, even though the open-source signal records are present.",
      "`meta.isSample` is true: the open-source signal block is simulated.",
    ],
  },
  {
    method: "GET",
    path: "/access/units",
    listedInIndex: true,
    group: "Access",
    title: "Access by reporting unit",
    summary: "Mapped hospitals, clinics, pharmacies and laboratories per dengue reporting unit, with reported dengue cases per year. Query: unitId.",
    description:
      "For each of the 126 HDX dengue reporting units: how many hospitals, clinics, pharmacies and laboratories are mapped in OpenStreetMap (HOT export on HDX), their density per 100 km², and the unit's reported dengue cases per year (2016-2020, usable weeks only). `medicineAvailability`, `searchDemand` and `population` are always null: no public source reports them, and they are never estimated.",
    parameters: [
      {
        name: "unitId",
        type: "string",
        required: false,
        notes: "One reporting unit, using the SIGMA map's unit id, for example \"quezon-city\" or \"rizal\".",
      },
    ],
    responseShape: [
      "scope — question, units, facilitiesMapped, supports[], doesNotSupport[], limitations[]",
      "sources[] — id, title, publisher, url, license, attribution, snapshot, edition, sha256",
      "units[] — id, name, unitType, regionId, psgcCode, areaSqKm, mappedFacilities, mappedPer100SqKm, population (null), medicineAvailability (null), searchDemand (null), dengue[]",
    ],
    status: "live",
    possibleStatuses: ["live"],
    isSample: false,
    auth: NO_AUTH,
    dataType: { name: "AccessUnitsData", from: "@sigma/contracts" },
    example: { query: "?unitId=quezon-city" },
    exampleResponse: {
      data: {
        scope: {
          question: "Can people in an area reach care and dengue medicines, and what do those medicines cost the public sector?",
          units: 1,
          facilitiesMapped: 718,
          supports: [
            "How many hospitals, clinics, pharmacies and laboratories are mapped in OpenStreetMap in each reporting unit, and how dense they are per 100 km².",
          ],
          doesNotSupport: ["Whether a medicine is in stock at any pharmacy or health centre (no public source reports it)."],
          limitations: [
            "Facility counts are places mapped in OpenStreetMap (snapshot 2026-10-13). Mapping completeness varies; a low count can mean low mapping, not low access. Barangay health stations are badly under-mapped (about 1,555 health posts in OSM against 27,286 BHS in the DOH registry).",
          ],
        },
        sources: [
          {
            id: "hotosm-phl-health-facilities",
            title: "Philippines Health Facilities (OpenStreetMap Export), GeoJSON",
            publisher: "Humanitarian OpenStreetMap Team (HOT) via HDX; data © OpenStreetMap contributors",
            url: "https://data.humdata.org/dataset/hotosm_phl_health_facilities",
            license: "ODbL 1.0 (Open Database License); derived data must stay under ODbL with attribution",
            attribution: "© OpenStreetMap contributors, ODbL",
            snapshot: "2026-10-13",
            edition: null,
            sha256: "9930f8c15636b937b3bf65ccda8f9665d3ea4e507cfb501ae6b5b3781959e788",
          },
        ],
        units: [
          {
            id: "quezon-city",
            name: "Quezon City",
            unitType: "city_huc",
            regionId: "ncr",
            psgcCode: "1381300000",
            areaSqKm: 162.4,
            mappedFacilities: { hospital: 59, clinic: 243, pharmacy: 367, laboratory: 49 },
            mappedPer100SqKm: { hospital: 36.33, clinic: 149.63, pharmacy: 225.99, laboratory: 30.17 },
            population: null,
            medicineAvailability: null,
            searchDemand: null,
            dengue: [{ year: 2016, reportedCases: 3731, usableWeeks: 45, weeks: 51 }],
          },
        ],
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-24T00:00:00.000Z",
        status: "live",
        isSample: false,
      },
    },
    exampleIsTrimmed: true,
    errors: [UNKNOWN_PARAM, BAD_REQUEST("`unitId` is not one of the 126 reporting units."), SERVER_ERROR],
    notes: [
      "\"live\" means real, pinned source data served as built: the facility layer is an OpenStreetMap snapshot and the dengue counts are historical (2016-2020). Neither is a real-time feed.",
      "A low facility count can mean low mapping in OpenStreetMap, not low access. Barangay health stations are badly under-mapped.",
      "Facilities © OpenStreetMap contributors, ODbL: credit it wherever the counts are shown.",
    ],
  },
  {
    method: "GET",
    path: "/access/medicines",
    listedInIndex: true,
    group: "Access",
    title: "Dengue medicine prices",
    summary: "Dengue medicines, their PNF formulary status and what DOH hospitals paid for them (2026 interim DPRI).",
    description:
      "Paracetamol, oral rehydration salts, Lactated Ringer's and 0.9% sodium chloride: whether each is on the Philippine National Formulary essential medicines list, and the lowest, median and highest unit price DOH hospitals paid in 2025 procurement, from the DOH Drug Price Reference Index. These are procurement prices, not pharmacy shelf prices, and say nothing about stock.",
    parameters: [],
    responseShape: [
      "scope — priceBasis, doesNotSupport[]",
      "sources[] — the DPRI source with its edition and pinned hash",
      "medicines[] — id, name, role, onPnfEml, pnfPage, basis, prices[] (item, status, lowestPhp, medianPhp, highestPhp, reportingFacilities)",
    ],
    status: "live",
    possibleStatuses: ["live"],
    isSample: false,
    auth: NO_AUTH,
    dataType: { name: "AccessMedicinesData", from: "@sigma/contracts" },
    example: { query: "" },
    exampleResponse: {
      data: {
        scope: {
          priceBasis:
            "Unit prices DOH hospitals paid in 2025 procurement (2026 interim Drug Price Reference Index): lowest, median and highest across reporting hospitals. Not private pharmacy shelf prices.",
          doesNotSupport: ["Whether a medicine is in stock at any pharmacy or health centre (no public source reports it)."],
        },
        sources: [],
        medicines: [
          {
            id: "paracetamol",
            name: "Paracetamol",
            role: "Fever and pain relief (NSAIDs such as ibuprofen and aspirin are avoided in dengue)",
            onPnfEml: true,
            pnfPage: "52-53",
            basis:
              "PNF Essential Medicines List Vol. I, 8th ed. (as of 2022-11-02), pp. 52-53, https://www.philhealth.gov.ph/partners/providers/pdf/PNF-EML_11022022.pdf; DPRI item names exactly as in the DOH dashboard",
            prices: [
              {
                item: "PARACETAMOL 500 mg tablet",
                status: "priced",
                lowestPhp: 0.39,
                medianPhp: 0.58,
                highestPhp: 2.25,
                reportingFacilities: 65,
              },
            ],
          },
        ],
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-24T00:00:00.000Z",
        status: "live",
        isSample: false,
      },
    },
    exampleIsTrimmed: true,
    errors: [UNKNOWN_PARAM, SERVER_ERROR],
    notes: [
      "Items the DOH hides in its public view are left out and listed with their status, never priced.",
      "Dengue rapid tests have no public price source and are not listed.",
    ],
  },
  {
    method: "GET",
    path: "/access/metrics",
    listedInIndex: true,
    group: "Access",
    title: "Access metrics (retired)",
    summary: "Retired. Weekly medicine stock and search indicators have no real source; use /access/units and /access/medicines.",
    description:
      "This endpoint served weekly demo inventory and search events. No public source reports medicine stock or searches, so it now answers `not_connected` with empty lists, and its scope block points to the real ACCESS endpoints. The accepted query parameters are unchanged so older clients still get a valid response.",
    parameters: [
      { name: "medicineId", type: "string", required: false, notes: "Accepted for compatibility; ignored." },
      { name: "areaId", type: "string", required: false, notes: "Accepted for compatibility; ignored." },
      { name: "limit", type: "integer", required: false, notes: "Accepted for compatibility; ignored." },
    ],
    responseShape: [
      "scope — source and sourceNote explain the retirement; counts are 0 and coverage is null",
      "medicines[], areas[], weeks[], metrics[], areasForAssessment[] — always empty",
    ],
    status: "not_connected",
    possibleStatuses: ["not_connected"],
    isSample: false,
    auth: NO_AUTH,
    dataType: { name: "AccessMetricsData", from: "@sigma/contracts" },
    example: { query: "" },
    exampleResponse: {
      data: {
        scope: {
          isSample: false,
          source: "Retired: no public source for weekly medicine stock or searches",
          sourceNote:
            "This endpoint served demo inventory. Real ACCESS data (mapped facilities, DOH medicine prices) is at /api/v1/access/units and /api/v1/access/medicines.",
          areas: 0,
          facilities: 0,
          medicines: 0,
          weeks: 0,
          coverage: { from: null, to: null },
          supports: [],
          doesNotSupport: ["Whether a medicine is in stock at any pharmacy or health centre (no public source reports it)."],
        },
        medicines: [],
        areas: [],
        weeks: [],
        metrics: [],
        areasForAssessment: [],
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-24T00:00:00.000Z",
        status: "not_connected",
        isSample: false,
      },
    },
    exampleIsTrimmed: true,
    errors: [UNKNOWN_PARAM, SERVER_ERROR],
    notes: ["Kept so existing clients (the Expo app) get a valid, honest response instead of an error."],
  },
  {
    method: "GET",
    path: "/policy/info",
    listedInIndex: true,
    group: "Policy",
    title: "Policy context",
    summary: "Assessment areas, evidence summary, supported diseases and the AI disclosure.",
    description:
      "Everything the Policy Copilot needs before a question is asked: the assessment areas, the evidence summary, the supported diseases, the list of areas, the AI disclosure, and the scope of the chat.",
    parameters: [],
    responseShape: [
      "scope — isSample, source, sourceNote, aiDisclosure",
      "evidenceSummary[] — one line per evidence point",
      "areasForAssessment[] — category, title, rationale, evidenceType, assessmentStatus",
      "whatSigmaDoesNot[] — the limits SIGMA states about itself",
      "supportedDiseases[] — the diseases the copilot can answer about",
      "chatScope[] — per disease, the locations the copilot has data for",
      "areas[] — id, name, province, region",
      "sources[] — the source catalogue",
      "limitations[]",
    ],
    status: "demo",
    possibleStatuses: ["demo"],
    isSample: true,
    auth: NO_AUTH,
    dataType: { name: "PolicyInfoData", from: "@sigma/contracts" },
    example: { query: "" },
    exampleResponse: {
      data: {
        scope: {
          isSample: true,
          source: "SIGMA demo evidence base (prototype)",
          sourceNote:
            "Areas for assessment are derived from simulated open-source signals and simulated facility inventory. They are review prompts for a human analyst, not findings about a real locality.",
          aiDisclosure:
            "Policy Copilot output is AI-generated analysis over demo evidence. It is not a verified government position, not an official advisory, and not a clinical or legal recommendation. A public-health professional must verify everything before it is used.",
        },
        evidenceSummary: ["Unusual deviation from historical baseline"],
        areasForAssessment: [
          {
            category: "Surveillance",
            title: "Surveillance",
            rationale: "Observed signal warrants verification against formal surveillance.",
            evidenceType: "Deviation from historical baseline",
            assessmentStatus: "for-assessment",
          },
        ],
        whatSigmaDoesNot: [
          "It does not confirm outbreaks.",
          "It does not diagnose patients.",
          "It does not prescribe policy.",
        ],
        supportedDiseases: [
          "Dengue",
          "Diarrheal disease",
          "Influenza-like illness",
          "Leptospirosis",
          "Measles",
        ],
        chatScope: [
          {
            disease: "Dengue",
            locationIds: [
              "quezon-city",
              "manila",
              "pasig",
              "caloocan",
              "taguig",
              "antipolo",
              "makati",
              "pasay",
            ],
          },
        ],
        areas: [
          {
            id: "quezon-city",
            name: "Quezon City",
            province: "Metro Manila",
            region: "NCR",
          },
        ],
        limitations: [
          "Every signal, trend and facility figure behind these assessment areas is simulated.",
        ],
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-21T00:00:00.000Z",
        status: "demo",
        isSample: true,
      },
    },
    exampleIsTrimmed: true,
    errors: [SERVER_ERROR],
    notes: [
      "`chatScope` is the useful one for a client: it lists, per disease, the locations the copilot actually has data for, so a client can offer only combinations that will succeed.",
      "`areasForAssessment` is a fixed prototype set. It is not computed from live data, and `scope.isSample` is true.",
    ],
  },
  {
    method: "GET",
    path: "/policy/evidence",
    listedInIndex: true,
    group: "Policy",
    title: "Policy evidence",
    summary: "The curated policy-evidence research pack, filterable by location, topic and verification status.",
    description:
      "The evidence records behind the policy work: one row per claim, each tied to the document it came from, with what was verified, what was not, and what remains unresolved. Every record states its verification status; no record is presented as a confirmed fact beyond what it cites.",
    parameters: [
      {
        name: "locationId",
        type: "string",
        required: false,
        notes: "Keeps the records for one location, plus the national records whose location is null.",
      },
      {
        name: "topic",
        type: "string",
        required: false,
        allowed: [
          "policy_adoption_mandate",
          "implementation_organizational",
          "surveillance_reporting",
          "budget_procurement_fiscal",
          "reported_outcomes",
          "governance_accountability",
          "evidence_gaps_unresolved",
        ],
        notes: "Keeps the records of one topic. Any other value is a 400.",
      },
      {
        name: "verificationStatus",
        type: "string",
        required: false,
        allowed: ["verified", "partially_verified", "needs_review"],
        notes: "Keeps the records of one verification status. Any other value is a 400.",
      },
    ],
    responseShape: [
      "researchPack — id, version, name, ingestedOn, and the source list",
      "records[] — one row per evidence claim",
      "records[].claim, sourceTitle, issuingOrganization, sourceUrl, sourceRef, publicationDate — the claim and its citation",
      "records[].verificationStatus — verified, partially_verified or needs_review",
      "records[].verifiedWhat[], unverifiedWhat[] — what the source does and does not establish",
      "records[].limitations[], caveats[], unresolvedQuestions[], notes[]",
      "records[].relationToSurveillancePeriod — how the claim relates to the surveillance window",
      "records[].financialStage, amount — the budget stage and amount, when the record has them",
      "limitations[] — the limits of the pack as a whole",
    ],
    status: "demo",
    possibleStatuses: ["demo"],
    isSample: true,
    auth: NO_AUTH,
    dataType: { name: "PolicyEvidenceRecord", from: null },
    example: { query: "?locationId=quezon-city" },
    exampleResponse: {
      data: {
        researchPack: {
          id: "pa-research-2026-10",
          version: "1.0.0",
          name: "SIGMA City Evidence and Comparison Matrix + Comparative LGU Evidence and Policy Recommendations",
          ingestedOn: "2026-10-20",
          sources: [
            {
              id: "S-001",
              title: "Quezon City Local Government Annual Report July 2024-June 2025",
              org: "Quezon City Government",
            },
            {
              id: "S-002",
              title: "Quezon City Government Annual Procurement Plan FY 2024",
              org: "Quezon City Government / QCHD",
            },
          ],
        },
        records: [
          {
            evidenceId: "pe-qc-annual-report-2025",
            researchPackId: "pa-research-2026-10",
            researchPackVersion: "1.0.0",
            locationId: "quezon-city",
            entityName: "Quezon City",
            geographicLevel: "city",
            topic: "reported_outcomes",
            claim:
              "QC annual report documents dengue outbreak response in February 2025; source states ~90% drop in dengue cases by April 2025 and 123 barangays cleared from outbreak status.",
            sourceTitle:
              "Quezon City Local Government Annual Report July 2024-June 2025",
            issuingOrganization: "Quezon City Government",
            sourceUrl:
              "https://quezoncity.gov.ph/wp-content/uploads/2025/12/Quezon-City-Local-Government-Annual-Report-2024-2025.pdf",
            sourceRef: "S-001",
            publicationDate: "2025-12-15",
            referencePeriod: "2024-2025",
            dateReviewed: "2026-10-19",
            evidenceType: "official_annual_report",
            verificationStatus: "verified",
            verifiedWhat: [
              "66 health centers provided daily free testing/consultations",
              "QCHIS had 693,728 registered users as of June 2025",
            ],
            unverifiedWhat: [
              "Weekly case series and definition/time window for 90% decline",
              "Clearance criteria",
              "Causal attribution",
            ],
            limitations: [
              "Administrative report, not independently evaluated causal impact.",
            ],
            caveats: ["Do not treat reported outcomes as proof of causality."],
            unresolvedQuestions: [
              "Need weekly case series, definition/time window for 90% decline, clearance criteria, intervention coverage, costs and causal evaluation.",
            ],
            notes: [
              "66 health centers operated daily; intensified monitoring in high-risk areas.",
            ],
            relationToSurveillancePeriod: "after_surveillance_period",
            financialStage: null,
            amount: null,
            sourceIds: ["S-001"],
          },
        ],
        limitations: [
          "Not an exhaustive census of Philippine LGUs; deeper coverage limited to reviewed cases.",
          "Many budget figures are planned/procurement plan amounts, not awards/payments/expenditures.",
        ],
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-21T00:00:00.000Z",
        status: "demo",
        isSample: true,
      },
    },
    exampleIsTrimmed: true,
    errors: [
      UNKNOWN_PARAM,
      BAD_REQUEST("`topic` or `verificationStatus` is not one of the accepted values."),
      SERVER_ERROR,
    ],
    notes: [
      "`meta.status` is \"demo\" because the pack is a curated research artefact, not a live feed. The records themselves are cited extracts from real documents, and each one states what it does and does not establish.",
      "Budget amounts are frequently planned or procurement-plan figures rather than awards, payments or expenditure. The `financialStage` field says which stage a figure is at.",
      "The pack is not an exhaustive census of Philippine LGUs; coverage is deeper for the reviewed cases.",
    ],
  },
  {
    method: "POST",
    path: "/chat",
    listedInIndex: true,
    group: "Policy",
    title: "Policy Copilot",
    summary: "Policy Copilot. Refuses the request when no model provider is configured.",
    description:
      "The Policy Copilot. The body is validated before any model call, and the response states what context the model actually received. When no model provider is configured the request is refused rather than answered with a placeholder reply.",
    parameters: [
      {
        name: "message",
        type: "body",
        required: true,
        notes: "A non-empty string, at most 2000 characters.",
      },
      {
        name: "history",
        type: "body",
        required: false,
        notes: "Earlier exchanges, oldest first, as complete pairs: { role: \"user\", content } then { role: \"assistant\", content, signature }, where signature is the replySignature this server returned for that reply. A system turn, a broken sequence, an unanswered question, or a reply not signed by this server for the same disease and LGU is a 400. Only the last 10 turns are kept.",
      },
      {
        name: "disease",
        type: "body",
        required: true,
        notes: "A supported disease. `GET /api/v1/policy/info` lists them.",
      },
      {
        name: "locationId",
        type: "body",
        required: true,
        notes: "A known LGU that has data for that disease. `policy/info` lists them under `chatScope`.",
      },
    ],
    responseShape: [
      "reply — the generated answer",
      "model — the model that produced it",
      "contextScope — one line describing what the model was given",
      "limitations[] — the limits of model output, repeated in every response",
      "replySignature — send back as this reply's signature in a later request's history",
    ],
    status: "demo",
    possibleStatuses: ["demo"],
    isSample: true,
    auth: CHAT_AUTH,
    dataType: { name: "ChatResponseData", from: "@sigma/contracts" },
    example: {
      query: "",
      body: {
        message: "What should we check first?",
        disease: "Dengue",
        locationId: "quezon-city",
      },
    },
    exampleResponse: {
      data: {
        reply:
          "Start with the reported cases for Quezon City and confirm the reporting week, then check the facility availability reports for the same period.",
        model: "openai/gpt-oss-20b",
        contextScope:
          "Demo evidence for Dengue in Quezon City, plus the source catalogue and stated limitations.",
        limitations: [
          "The reply is generated by a language model over demo evidence and can be wrong.",
          "It is not a verified government position and not an official advisory.",
          "It does not confirm outbreaks, diagnose patients, or prescribe policy.",
          "The underlying signals, trends and facility figures are simulated.",
        ],
        replySignature: "q3Yl8m0V2b7pF4cR9xT1uW6eH5kJ0nA2sD8gZ3vL1oQ",
      },
      meta: {
        apiVersion: "v1",
        generatedAt: "2026-10-21T00:00:00.000Z",
        status: "demo",
        isSample: true,
      },
    },
    exampleIsTrimmed: false,
    errors: [
      {
        status: 400,
        code: "bad_request",
        when: "The body is not JSON, or `message` is missing or empty, or `disease` is unsupported, or `locationId` is unknown or has no data for that disease.",
      },
      {
        status: 405,
        code: "method_not_allowed",
        when: "The endpoint is called with a method other than POST. The response carries an `Allow: POST` header.",
      },
      {
        status: 413,
        code: "payload_too_large",
        when: "The request body is larger than 16 KB.",
      },
      {
        status: 429,
        code: "rate_limited",
        when: "More than 30 requests in 60 seconds from the same IP address. The response carries a `Retry-After` header.",
      },
      {
        status: 502,
        code: "upstream_unavailable",
        when: "The model provider could not be reached, or answered with something unusable.",
      },
      {
        status: 503,
        code: "not_configured",
        when: "No model provider is configured on the server. Nothing is returned in place of a real answer.",
      },
      {
        status: 504,
        code: "upstream_unavailable",
        when: "The model provider did not answer within 30 seconds.",
      },
      SERVER_ERROR,
    ],
    notes: [
      "The rate limit is 30 requests per 60 seconds per IP address, held in the memory of the server instance that handled the request.",
      "This is the only endpoint that reaches a paid external service. The provider key is read from the server environment, is never returned to a client, and is never exposed in the browser bundle.",
      "`GET` on this endpoint is a 405, not a 404.",
    ],
  },
];

/** The error codes the API can return, with the meaning of each. */
export const ERROR_CODES: { code: ApiErrorCode; status: number; meaning: string }[] = [
  {
    code: "bad_request",
    status: 400,
    meaning:
      "The request was understood and rejected: an unknown parameter, an out-of-range value, or a body that failed validation.",
  },
  {
    code: "not_found",
    status: 404,
    meaning:
      "The path does not exist, or the named series, disease or location is not connected.",
  },
  {
    code: "method_not_allowed",
    status: 405,
    meaning: "The endpoint exists but not for this HTTP method. The `Allow` header lists the ones it accepts.",
  },
  {
    code: "payload_too_large",
    status: 413,
    meaning: "The request body is over the 16 KB limit.",
  },
  {
    code: "rate_limited",
    status: 429,
    meaning:
      "Too many requests from this IP address. The `Retry-After` header says how long to wait.",
  },
  {
    code: "unavailable",
    status: 503,
    meaning:
      "The capability exists but there is no data to serve right now. This is different from a 404.",
  },
  {
    code: "not_configured",
    status: 503,
    meaning:
      "The server is missing an integration the request needs. Nothing is returned in place of a real answer.",
  },
  {
    code: "upstream_unavailable",
    status: 502,
    meaning: "An upstream service could not be reached or answered with something unusable.",
  },
  {
    code: "internal_error",
    status: 500,
    meaning:
      "An unexpected failure inside the handler. The message is deliberately generic and never carries an internal detail.",
  },
];

/**
 * The data-status glossary.
 *
 * These are the only four values the shared `DataStatus` contract allows.
 * The list below is checked against that contract by a test, so it cannot
 * drift away from what the API can actually return.
 */
export const STATUS_GLOSSARY: {
  status: DataStatus;
  label: string;
  meaning: string;
  /** What a client should do with it. */
  guidance: string;
}[] = [
  {
    status: "live",
    label: "Live",
    meaning:
      "The payload came from a connected source and the records are observed, not simulated.",
    guidance:
      "Show it as observed data — but check the coverage window. A connected source can serve a series that stopped years ago, and \"live\" describes the connection, not the currency of the records.",
  },
  {
    status: "demo",
    label: "Demo data",
    meaning: "The payload holds simulated or prototype records.",
    guidance:
      "Label it as simulated wherever it is shown. `meta.isSample` is true alongside this status, and a demo figure must never be presented as a measurement.",
  },
  {
    status: "unavailable",
    label: "Unavailable",
    meaning:
      "The capability exists, but there is no data to serve right now. Every failed response also carries this status.",
    guidance:
      "Do not read it as zero, and do not read it as \"nothing to report\". An empty array and a missing capability are different facts.",
  },
  {
    status: "not_connected",
    label: "Not connected",
    meaning:
      "The capability has not been wired to a source yet, so the endpoint has nothing real to return.",
    guidance:
      "Say so explicitly. An empty result under this status is a gap in the system, not a finding about the world.",
  },
];

/**
 * A state a client may derive, which the API does not report.
 *
 * The API reports "live" for a connected source even when the newest record
 * it holds is years old. A client that wants to be precise can compare the
 * newest period in the payload with the current date and label the series
 * "historical" itself. The mobile client does exactly this.
 */
export const DERIVED_STATES: {
  label: string;
  meaning: string;
  rule: string;
}[] = [
  {
    label: "Historical data",
    meaning:
      "Real, observed records from a connected source, but the newest period they contain has already passed.",
    rule:
      "Derive it, do not expect it: compare the newest period in the payload with the current date. The API never sends this status.",
  },
];

/** The request limits, read from the same constants the handlers use. */
export const API_LIMITS: { limit: string; value: string }[] = [
  { limit: "Observation records per request", value: "2000" },
  { limit: "Weekly summary points per request", value: "1200" },
  { limit: "ACCESS metric rows per request", value: "1000" },
  { limit: "JSON request body", value: "16 KB" },
  { limit: "Chat message length", value: "2000 characters" },
  { limit: "Chat history messages kept", value: "10" },
  { limit: "Completion tokens requested", value: "1500" },
  { limit: "Upstream model timeout", value: "30 s" },
  { limit: "Copilot requests per IP per minute", value: "30" },
];

export const ENDPOINT_GROUPS: EndpointGroup[] = [
  "Reference",
  "Service",
  "Surveillance",
  "Access",
  "Policy",
];

/** Looks an endpoint up by method and path. */
export function findEndpoint(method: HttpMethod, path: string): ApiEndpoint | undefined {
  return API_ENDPOINTS.find((endpoint) => endpoint.method === method && endpoint.path === path);
}

/**
 * The full path of an endpoint, below the version root.
 *
 * The index endpoint lives at the version root itself, so it is the one
 * exception.
 */
export function endpointUrl(endpoint: ApiEndpoint, baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, "");
  return endpoint.path === "/" ? root : `${root}${endpoint.path}`;
}

/** A `curl` command for the endpoint, built from its own definition. */
export function curlExample(endpoint: ApiEndpoint, baseUrl: string): string {
  const url = `${endpointUrl(endpoint, baseUrl)}${endpoint.example.query}`;
  if (endpoint.method === "GET") {
    return `curl -sS "${url}"`;
  }
  return [
    `curl -sS -X POST "${url}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(endpoint.example.body ?? {}, null, 2)}'`,
  ].join("\n");
}

/**
 * A TypeScript call for the endpoint, built from its own definition.
 *
 * The payload type is the one the shared contract declares, so a client
 * that depends on `@sigma/contracts` gets the same types the server uses.
 */
export function typescriptExample(endpoint: ApiEndpoint, baseUrl: string): string {
  const typeName = endpoint.dataType.name;
  const contractImport = endpoint.dataType.from === "@sigma/contracts";
  const imports = contractImport
    ? `import type { ApiSuccess, ${typeName} } from "@sigma/contracts";`
    : `// ${typeName} is not in the shared contract package yet.\ninterface ${typeName} {\n  [key: string]: unknown;\n}`;

  const relativePath = endpoint.path === "/" ? "" : endpoint.path;

  const fetchCall =
    endpoint.method === "GET"
      ? `const response = await fetch(\`\${baseUrl}${relativePath}${endpoint.example.query}\`);`
      : [
          `const response = await fetch(\`\${baseUrl}${relativePath}\`, {`,
          `  method: "POST",`,
          `  headers: { "Content-Type": "application/json" },`,
          `  body: JSON.stringify(${JSON.stringify(endpoint.example.body ?? {}, null, 2)}),`,
          `});`,
        ].join("\n");

  return [
    imports,
    "",
    `const baseUrl = "${baseUrl}";`,
    "",
    fetchCall,
    "if (!response.ok) {",
    "  const failure = await response.json();",
    '  throw new Error(`${failure.error.code}: ${failure.error.message}`);',
    "}",
    "",
    `const body = (await response.json()) as ApiSuccess<${typeName}>;`,
    `// body.meta.status is "${endpoint.status}" for this endpoint.`,
    "const data = body.data;",
  ].join("\n");
}
