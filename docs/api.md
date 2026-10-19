# SIGMA — APIs and integrations

Describes `main` at `8be0e89` (2026-10-19). See
[architecture.md](architecture.md) for how these pieces fit together and
[system-flow.md](system-flow.md) for when they are called.

## 1. Internal HTTP endpoints: none

SIGMA has **no application API** today. Checked on `main` and on open PRs
#1 and #3:

- No `web/src/app/api/` directory and no `route.ts` Route Handler anywhere.
- No Server Actions (`"use server"`), no `NextResponse`, no `fetch(` call in
  `web/src`.
- No Python web server in `ml/` (scripts only).
- No authentication, authorization or rate limiting, because nothing is
  exposed.

All data reaches the browser as props serialized by Next.js while it renders
Server Components (React Server Component payload). There is no stable,
documented wire format to call from other clients, including a future mobile
app (see [mobile.md](mobile.md)).

Consequently there are no request/response schemas, error codes or endpoint
tests to document. If an endpoint is added, document it in §5 using the
template there.

## 2. Internal data interfaces (TypeScript, server-side)

These are the contracts pages call. They are function calls inside the
Next.js server process, not HTTP APIs.

### 2.1 `DataProvider` — `web/src/data/provider.ts`

Active implementation: `dataProvider` exported from
`web/src/data/opendengue-provider.ts` (`OpenDengueProvider`, `server-only`).

| Method | Returns | Backed by | Notes |
| --- | --- | --- | --- |
| `getDiseases()` | `{ id, name }[]` | `web/src/data/sample/reference.ts` (demo) | |
| `getSignals(query?: { disease?, locationId? })` | `Signal[]` | `web/src/data/demo-signals.ts` (**demo**) | `disease` is the display name, e.g. `"Dengue"` |
| `getHealthObservations(diseaseId, geographyId?, { temporalResolution? }?)` | `HealthObservation[]` | `web/src/data/opendengue-ph.json` (**real**) | Only `diseaseId = "dengue"`, `geographyId = "ph"`, weekly; anything else returns `[]` |
| `getLgus()` / `getLguById(id)` | `LGU[]` / `LGU \| undefined` | `web/src/data/demo-lgus.ts` | 12 LGUs; real names, demo use |
| `getTrendSeries(geographyId)` | `TrendPoint[] \| undefined` | `web/src/data/demo-trends.ts` (**demo**) | Generated curves |
| `getNeighborSummaries(geographyId)` | `NeighborSummary[]` | `web/src/lib/neighbors.ts` (**demo**) | Nearest by centroid distance |
| `getAnomalyResults(diseaseId, geographyId)` | `AnomalyResult[]` | — | **Always `[]`**: no model connected ([next-steps.md](next-steps.md) P1-3) |

Errors: methods resolve synchronously from in-memory data and do not throw in
normal operation. Callers still guard. `web/src/app/lab/page.tsx` turns a
thrown error into `{ status: "unavailable", message }`, and
`web/src/app/page.tsx` turns it into `null`, which renders a "Formal
observations: Unavailable" card.

### 2.2 `AccessDataProvider` — `web/src/data/access-provider.ts`

Active implementation: `DemoAccessProvider` (`isSample = true`,
`server-only`). Methods: `getMedicines`, `getFacilities`,
`getInventorySnapshots(medicineId?)`, `getSearchEvents(medicineId?)`,
`getReportingWeeks`, `getFreshnessThresholds`. All data is synthetic
(`web/src/data/demo-*.ts`). Design of the future tables:
[access-data-model.md](access-data-model.md).

### 2.3 Server loaders

| Function | File | Used by | Returns |
| --- | --- | --- | --- |
| `loadMapBundle()` | `web/src/lib/map/load-bundle.ts` | `/explore` | `MapDataBundle`: signals, LGUs, per-LGU trends and neighbours, `nationalWeekly` (`periodStart`, `periodEnd`, `value`), demo scenario, access bundle |
| `loadAccessMapBundle()` | same | `/access` | Same shape; only LGUs and access filled |
| `loadAccessBundle(provider?)` | `web/src/lib/access/load.ts` | `/policy`, both map loaders | `AccessBundle` (`web/src/lib/access/bundle.ts`): aggregated states and metrics only; raw search events stay on the server |
| `summarizeNational(observations)` | `web/src/lib/national-observations.ts` | `/`, `/lab` | `NationalSummary`: gap-aware weekly series (`value: null` for missing weeks), gaps, stats, epi-year completeness, seasonal profile, origins |
| `toObservationFrame(observations)` | same | nothing yet | Model-ready rows for future model code |
| `accessAssessments(bundle, weekIndex?)` | `web/src/lib/access/assessments.ts` | `/policy`, `/access` | Review prompts for non-`low` access gaps |

### 2.4 Type contracts

`web/src/types/data.ts` (data layer: `HealthObservation`,
`PublicHealthSignal`, `SignalSource`, `GeographicEntity`, `Source`,
`AnomalyResult`, `ForecastResult`, `TrendSeries`, `SpatialRelationship`,
`SimulationScenario`, `Provenance`, `Measure`), `web/src/types/index.ts` (UI
view models), `web/src/types/access.ts` (ACCESS). The planned signal pipeline
contract is in `web/src/lib/signals/pipeline.ts` (types only).

## 3. Offline data products (file interfaces)

| Product | Producer | Format / key columns | Committed? |
| --- | --- | --- | --- |
| `web/src/data/opendengue-ph.json` | `web/scripts/build-opendengue.mjs` | `meta` (source, version, licence, sha256, validated stats) + `rows[]` (`id`, `periodStart`, `periodEnd`, `value`, `sourceRecordId`, …) | Yes |
| `data/processed/dengue_cases_combined.xlsx` | `ml/clean_dengue.py` | Sheets NATIONAL, LOCAL: `period_start`, `value`, `data_quality`, `data_flag`, `epi_year`, `epi_week`, `alert_threshold`, `epidemic_threshold`, `doh_status`, `doh_note` (+ `region`, `geography_name` for LOCAL) | No (git-ignored) |
| `data/processed/dengue_ears.xlsx` | `ml/ears.py` | Sheets NATIONAL, LOCAL, METHOD: `c1_*`, `c2_*`, `c3_*`, `ears_alarm`, `ears_note`, `flag_note`, `doh_status` | No (git-ignored) |
| `docs/reports/dengue_qa_report.pdf`, `docs/reports/dengue_ears_qa_report.pdf` | `ml/qa/*.py` | PDF | Yes |

Column meanings: [dengue-pipeline.md](dengue-pipeline.md).

## 4. External integrations

### 4.1 Called at runtime by the deployed app

| Integration | Where | Env vars | Auth | Constraints / failure behaviour |
| --- | --- | --- | --- | --- |
| MapTiler Cloud (vector style + terrain-RGB DEM) | `web/src/lib/map/basemap.ts` | `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_STYLE` (default `dataviz`) | Key in URL query string; public by design, so restrict it to deployment origins in MapTiler | On an HTTP error from the style, `map-canvas.tsx` switches to the OSM fallback and shows a notice. Quotas depend on the MapTiler plan (not recorded) |
| Custom MapLibre style | same | `NEXT_PUBLIC_MAP_STYLE_URL` | Whatever the URL embeds | Takes precedence over MapTiler |
| OpenStreetMap raster tiles `tile.openstreetmap.org` | same (`OSM_RASTER_STYLE`) | none | none | Key-less fallback. The OSM tile usage policy discourages heavy or production use ([next-steps.md](next-steps.md) P2-4) |

All three are browser-side requests. `NEXT_PUBLIC_*` values are inlined at
build time, so changing them requires a rebuild. No server-side secret is
used anywhere.

### 4.2 Used at build or data-preparation time

| Integration | Used by | Notes |
| --- | --- | --- |
| Google Fonts (Geist, Geist Mono via `next/font/google`) | `web/src/app/layout.tsx` | Fetched by Next.js at build time and self-hosted; the build needs network access |
| OpenDengue v1.3 Temporal extract | the missing `scripts/build_opendengue.py` → `build-opendengue.mjs` | `https://opendengue.org/assets/Temporal_extract_WPRO_V1_3.zip`, CC BY 4.0 (from fixture `meta`) |
| HDX "Philippine Dengue Cases and Deaths" (DOH-Epi 2016–2021, Cirrolytix) | `ml/clean_dengue.py` (placed by hand on `main`) | CC BY; provenance not recorded on `main` ([next-steps.md](next-steps.md) P0-4) |

### 4.3 In open pull requests only (not on `main`)

| Integration | PR | Access | Notes |
| --- | --- | --- | --- |
| HDX CKAN API `package_show` + resource downloads (`project-cchain`, `philippine-dengue-cases-and-deaths`) | #1 `ml/environment/fetch.py`; #3 `scripts/geo/fetch-sources.mjs` | Anonymous HTTPS | Writes a manifest with URL, `last_modified`, SHA-256 |
| OCHA COD-AB PHL v03, COD-PS 2022 | #3 | Anonymous HTTPS | CC BY-IGO |
| PSA PSGC 3Q 2026 datafile | #3 | **Manual download**; psa.gov.ph returns 403 to scripts | Not redistributable; kept in `data/raw/psa_psgc/` |

### 4.4 Model / AI APIs

None. No LLM or AI SDK is in `web/package.json` or `ml/requirements.txt`, and
no code calls a model provider. See [prompt.md](prompt.md).

## 5. Planned endpoints

No endpoint is specified anywhere in the repository. The following are
**needs, not designs**. Each is listed with the backlog item that would
create it:

| Need | Source of the need | Backlog |
| --- | --- | --- |
| Serve EARS / DOH results to the app | `getAnomalyResults` returns `[]` | P1-3 (may be a fixture, not an API) |
| Database-backed providers | `SupabaseDataProvider`, `SupabaseAccessProvider` named in code; `ml/.env.example` | P3-3 |
| Policy assistant request/response | Requested in the audit brief; nothing in code | P1-6, P3-6 |
| A stable JSON API for non-web clients | Mobile options in [mobile.md](mobile.md) | P3-1 |

### Template for documenting a new endpoint

```markdown
### <METHOD> /api/<path>
- Purpose:
- Handler file:
- Request: (TypeScript type or JSON schema; size limits)
- Response 200: (type)
- Errors: (status → body → when)
- Validation:
- Auth:
- Env vars: (names only; never values)
- Provider limits / rate limits:
- Tests: (file, what is covered)
- Example (illustrative values):
```
