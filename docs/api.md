# The SIGMA API

The web app serves a versioned JSON API under `/api/v1`. The Expo client in
`mobile/` is its only other consumer, and the shared request/response types
live in `packages/sigma-contracts`.

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

Service status and configuration **flags only** — `aiProviderConfigured` and
`mapTilesConfigured` are booleans. No environment value is ever returned.

### `GET /api/v1/sources`

The source catalogue. Each source states its status (`connected`, `demo`,
`planned`), what it is for, and what it cannot answer. A planned source
stays `planned`; nothing is reported as connected before it is.

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

| Parameter   | Type   | Notes                |
| ----------- | ------ | -------------------- |
| `disease`   | string | Defaults to `Dengue`.|
| `locationId` | string | Optional.            |

Anomaly results, plus the open-source signal demo data in a separate,
clearly labelled block. While no anomaly model is connected to the API,
`status` is `not_connected`, `signals` is empty, and `reason` explains
that this is not evidence that no outbreak is occurring. The EARS engine
that would produce these results is described in `engine`, including its
method, its data window, and its limitations.

### `GET /api/v1/access/metrics`

| Parameter    | Type   | Notes                    |
| ------------ | ------ | ------------------------ |
| `medicineId` | string | Optional.                |
| `areaId`     | string | Optional.                |
| `limit`      | int    | 1–1000, defaults to max. |

Weekly medication-access indicators per area and medicine. The payload
carries a `scope` block stating what the data can and cannot support. The
records are simulated: a facility listed here has a demo record, which does
not establish that the facility is operating, stocked, staffed or clinically
accessible. The response is `status: "demo"`.

### `GET /api/v1/policy/info`

Assessment areas, the evidence summary, the supported diseases, the list of
areas, and the AI disclosure. `chatScope` lists, per disease, the locations
the copilot actually has data for, so a client can offer only combinations
that will succeed.

### `POST /api/v1/chat`

The Policy Copilot.

```json
{
  "message": "What should we check first?",
  "history": [{ "role": "user", "content": "..." }],
  "disease": "Dengue",
  "locationId": "quezon-city"
}
```

The body is validated before any model call: the message must be present
and within the length limit, the disease must be supported, and the LGU
must exist and have data for that disease. History is trimmed to the last
ten messages.

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
be the whole series, and an empty anomaly list is reported as `not_connected`
rather than as "no outbreak". The mobile client has its own tests for the
error mapping; see [mobile.md](mobile.md).

## Authentication

There is none. The API is read-only and serves public or simulated data.
`POST /api/v1/chat` does reach a paid model provider, so it inherits the
is the only intended chat endpoint (the legacy `/api/policy-chat` route has been removed). It is
intended for a prototype deployment, not for public exposure.
