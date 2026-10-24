# The SIGMA API

The web app serves a versioned JSON API under `/api/v1`. The Expo client in
`mobile/` is its only other consumer, and the shared request/response types
live in `packages/sigma-contracts`.

A rendered, human-readable reference for the same API is served at
`/documentation` in the web app. It is rendered from the same registry
(`web/src/lib/api/registry.ts`) that the `GET /api/v1` index is generated
from, and a test checks that registry against the route files and the real
handler responses, so the two cannot drift apart.

## Envelopes

Every response is one of two shapes. There is no third.

Success:

```json
{
  "data": { "...": "the payload" },
  "meta": {
    "apiVersion": "v1",
    "generatedAt": "2026-10-19T15:10:18.950Z",
    "status": "live",
    "isSample": false
  }
}
```

Failure:

```json
{
  "error": {
    "code": "bad_request",
    "message": "\"limit\" must be between 1 and 2000.",
    "details": { "limit": ["out of range (1–2000)"] }
  },
  "meta": { "apiVersion": "v1", "generatedAt": "...", "status": "unavailable", "isSample": false }
}
```

`meta.status` is the part to branch on:

| Status          | Meaning                                                       |
| --------------- | ------------------------------------------------------------- |
| `live`          | Real records from a connected source.                          |
| `demo`          | Simulated / prototype records.                                 |
| `unavailable`   | The capability exists but there is no data right now.          |
| `not_connected` | The capability has not been wired to a source yet.             |

These four are the only values the shared `DataStatus` contract allows. A
client may derive further states for itself — the mobile client reports
"historical data" when the API says `live` but the newest period in the
payload has already passed — but the API never sends one. A connected source
is not a current source: the national dengue series is `live` and ends on
2023-11-25.

An empty array never means "zero cases" and never means "no outbreak". A
capability that is not connected says so in `status` and in a `reason`
field, so a client cannot mistake silence for a finding.

Error codes: `bad_request`, `not_found`, `method_not_allowed`,
`payload_too_large`, `rate_limited`, `unavailable`, `not_configured`,
`upstream_unavailable`, `internal_error`. Messages are written for a client
to display; internal exceptions, stack traces and environment values never
appear in a response.

## Endpoints

### `GET /api/v1`

The endpoint index.

### `GET /api/v1/health`

Service status and configuration **flags only** — `aiProviderConfigured`,
`chatEnabled` and `mapTilesConfigured` are booleans. No environment value is
ever returned. `chatEnabled` is false when no key is configured *or* when
`CHAT_DISABLED` / `CHAT_PUBLIC_DISABLED` is `true`, matching what
`POST /api/v1/chat` will do.

### `GET /api/v1/sources`

The source catalogue. Each source states its status (`connected`, `demo`,
`planned`), what it is for, and what it cannot answer. A planned source
stays `planned`; nothing is reported as connected before it is. The web app
renders the same catalogue, with licences and credit lines, at `/data-sources`.

### `GET /api/v1/dengue/observations`

Raw weekly observation records from the national OpenDengue v1.3 series.

| Parameter | Type   | Notes                                          |
| --------- | ------ | ---------------------------------------------- |
| `disease` | string | Defaults to `dengue`.                          |
| `from`    | date   | ISO `YYYY-MM-DD`, inclusive.                   |
| `to`      | date   | ISO `YYYY-MM-DD`, inclusive.                   |
| `limit`   | int    | 1–2000, defaults to the maximum.              |

Missing weeks are absent from the source, so they are absent here. The
response is never zero-filled and never interpolated. `series.gaps` lists
the missing runs, and `series.limitations` says what the series cannot
support.

### `GET /api/v1/dengue/summary`

Weekly, monthly and yearly aggregates of the same series.

| Parameter | Type | Notes                             |
| --------- | ---- | --------------------------------- |
| `limit`   | int  | 1–1200, defaults to the maximum.  |

The three resolutions are separate reporting streams and are never summed
into one another. A missing week appears as `value: null`. Annual totals
are meaningful only for epi years where every week was recorded; the
`weekly.epiYears` block marks each year `complete`, `truncated` or
gap-bearing.

### `GET /api/v1/dengue/signals`

| Parameter    | Type   | Notes |
| ------------ | ------ | ----- |
| `disease`    | string | Defaults to `Dengue`. |
| `locationId` | string | Optional. A reporting unit id; without `week`, that unit's whole series. Unknown ids are a 400. |
| `week`       | string | Optional. A week start (Sunday, `YYYY-MM-DD`) from 2016-01-10 to 2021-01-03. Default: the latest week with an EARS result, all units. |

EARS C1/C2/C3 results per HDX reporting unit and week, read from the
committed SIGMA export (`ml/ears.py` → `ml/export_sigma_web.py` →
`web/public/data/sigma/hdx-dengue-sigma.json`), `live` and historical. One
record per unit, week and method whose statistic was computed on a usable
week: `value`, `threshold`, and `alarm` (the export's label, which also
requires at least 5 cases). A missing or suspect-swap week, or a method with
too short a baseline, has **no record**: that is "no result", not a zero and
not "no signal". If the export cannot be read the status is `not_connected`.
`meta.isSample` is `false`: every record is computed from real reports. Without parameters (2021-01-03): 327 records,
9 alarms.

### `GET /api/v1/dengue/units`

Per HDX reporting unit (126, optional `unitId`) and epi year 2016–2020: cases over usable weeks, EARS alarm weeks and DOH-threshold weeks from the SIGMA export, `live`, historical; a count that could not be computed (no usable week, no EARS baseline, no DOH threshold before 2019) is `null`, never 0.

### `GET /api/v1/access/metrics`

| Parameter    | Type   | Notes                    |
| ------------ | ------ | ------------------------ |
| `medicineId` | string | Optional.                |
| `areaId`     | string | Optional.                |
| `limit`      | int    | 1–1000, defaults to max. |

Retired. No public source reports weekly medicine stock or searches, so it
answers `not_connected` with empty lists; real ACCESS data is at
`/access/units` and `/access/medicines`.

### `GET /api/v1/policy/info`

Assessment areas, the evidence summary, the supported diseases, the list of
areas, and the AI disclosure. `chatScope` lists, per disease, the locations
the copilot actually has data for, so a client can offer only combinations
that will succeed.

### `GET /api/v1/policy/evidence`

The curated policy-evidence research pack.

| Parameter            | Type   | Notes                                                     |
| -------------------- | ------ | --------------------------------------------------------- |
| `locationId`         | string | Optional. Keeps one location plus the national records.   |
| `topic`              | string | Optional. One of the seven evidence topics.               |
| `verificationStatus` | string | Optional. `verified`, `partially_verified` or `needs_review`. |

Each record is one claim, tied to the document it came from, with
`verifiedWhat`, `unverifiedWhat`, `limitations`, `caveats` and
`unresolvedQuestions` stated alongside it. Budget amounts carry a
`financialStage`, because many of them are planned amounts rather than awards,
payments or expenditure. The pack is not an exhaustive census of Philippine
LGUs.

### `POST /api/v1/chat`

The Policy Copilot.

```json
{
  "message": "What should we check first?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "...", "signature": "<replySignature>" }
  ],
  "disease": "Dengue",
  "locationId": "quezon-city"
}
```

The body is validated before any model call: the message must be present
and within the length limit, the disease must be supported, and the LGU
must exist and have data for that disease. History is trimmed to the last
ten messages.

History is accepted only as complete question/answer pairs. Each reply carries
the `replySignature` the server returned with it (an HMAC over the disease,
LGU, question and reply, keyed by `CHAT_HISTORY_SECRET` or a key derived from
the provider key). A `system` turn, a broken sequence, a trailing unanswered
question, or a reply the server did not sign for the same disease and LGU is
rejected with a 400. A client therefore cannot insert words into the model's
earlier replies, and a Quezon City conversation cannot be carried into Pasig.
The system prompt is always built on the server and includes a scope rule
(this disease and LGU, public health only); off-topic refusals rely on the
model following that rule.

When no model provider is configured the request is refused with
`not_configured` and a 503. Nothing is returned in place of a real answer.
When a provider is configured, the response states what context the model
actually received in `contextScope`, and repeats the limitations of AI
output in `limitations`.

## Limits

| Limit                     | Value    |
| ------------------------- | -------- |
| Observations per request  | 2000     |
| Summary points per request| 1200     |
| ACCESS metric rows        | 1000     |
| JSON body size            | 16 KB    |
| Chat message length       | 2000     |
| Chat history messages     | 10       |
| Completion tokens         | 1500     |
| Upstream timeout          | 30 s     |

## Checks

```bash
cd web
npm run lint
npm run typecheck
npm run test
npm run build
```

The test suite is deterministic. The route-level tests run against the
committed OpenDengue fixture, so they assert the real shape of a response
rather than a mock of it, and the service-layer tests pin the rules that
matter most here: a missing week is never zero-filled, a slice never claims to
be the whole series, and a selection with no EARS record is explained as "no
computable result", never as "no outbreak". The mobile client has its own tests for the
error mapping; see [mobile.md](mobile.md).

## Authentication

There is none. No endpoint reads an API key, a bearer token or a session, and
none of them requires one: the API is read-only and serves public or
simulated data.

`POST /api/v1/chat` is the only endpoint that reaches a paid external
service. Its provider key is read from the server environment, is never
returned to a client and is never exposed in the browser bundle. It is rate
limited to 30 requests per 60 seconds per IP address (in memory, per server
instance; requests without a client address share one bucket), and without a
configured provider it refuses the request with `not_configured` rather than
answering with a placeholder. `GET` on the same path is a 405.

The legacy `/api/policy-chat` route has been removed; `/api/v1/chat` is the
only chat endpoint.

This is a prototype deployment, not a hardened public API. There is no API
key management, no quota beyond the copilot rate limit, and no per-consumer
accounting.
