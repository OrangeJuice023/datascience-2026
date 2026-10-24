# SIGMA

**S**patial **I**ntelligence & **G**eographic **M**odeling for **A**ction

SIGMA is a public-health intelligence prototype for the Philippines, built for
PJDSC 2026. It brings formal surveillance data, open-source signals and
geography together so that analysts and local health offices can see where
dengue activity is unusual, how it compares with official thresholds, and
where to look more closely.

> **Status: hackathon prototype.** SIGMA does not predict outbreaks, issue
> operational alerts, or provide real-time nationwide surveillance. Its dengue
> analysis is retrospective (2016–2021), several modules run on clearly labelled
> demo data, and nothing here is a validated public-health claim.

**Live site:** <https://datascience-2026.vercel.app> (Vercel production deploys
from `main`). **API reference:** [`/documentation`](https://datascience-2026.vercel.app/documentation).

## What it supports

Dengue surveillance in the Philippines relies on weekly reports that arrive late,
vary in completeness between areas, and are judged against seasonal thresholds.
SIGMA explores three questions on that data:

- **Is this week unusual?** EARS C1/C2/C3 flag sudden rises against recent weeks;
  the DOH alert/epidemic threshold flags levels that are high for the season.
- **Where?** Results are mapped to the 126 DOH reporting units (provinces,
  province remainders, cities and Pateros).
- **What should be reviewed?** Findings become *areas for assessment* for a human
  decision-maker. SIGMA suggests what to look at; it never prescribes policy.

## Workflow and modules

```
TRACE (Lab) ──► ANALYZE (Explore) ──► ACT (Policy)
 signals          anomalies, maps       areas for assessment
                         └── ACCESS (medicine access) ──┘
```

| Module | Route | What it does | Data behind it |
| --- | --- | --- | --- |
| Overview | `/` | Landing dashboard and entry point to the modules | Mixed real and demo; see the module rows below |
| Explore | `/explore` | Signal Explorer map: dengue cases, DOH thresholds and EARS results per reporting unit, weekly city weather (Environment), plus signal, anomaly and scenario layers | **Real** HDX DOH dengue 2016–2021 (retrospective export) and **real** weather for 12 CCHAIN cities; other layers demo |
| Lab | `/lab` | Investigate the pattern behind a signal | **Real** OpenDengue national weekly series |
| ACCESS | `/access` | Medicine availability, search demand and potential access gaps | **Demo** (simulated facilities, inventory and searches) |
| Policy | `/policy` | LGU decision support: areas for verification and assessment, Policy Copilot | Demo evidence; Copilot needs a server-side model key |
| Data Sources | `/data-sources` | Every dataset SIGMA uses: purpose, where it appears, coverage, update behaviour, licence and credit line; demo and planned sources listed separately | Rendered from the source catalogue (`web/src/data/source-catalog.ts`), the same one `GET /api/v1/sources` serves |
| Documentation | `/documentation` | Rendered API reference | Generated from the API registry |

## Architecture

```
web/                    Next.js 16 (App Router) + TypeScript + Tailwind; MapLibre, deck.gl, Recharts
  src/app/api/v1/       The versioned JSON API (route handlers)
  src/lib/api/          API service layer and the endpoint registry (single source for /api/v1 and /documentation)
mobile/                 Expo + React Native client that reads the API
packages/sigma-contracts/  Type-only request/response contracts shared by web and mobile
ml/                     Python dengue pipeline: clean_dengue.py → ears.py → export_sigma_web.py; QA reports in ml/qa/
scripts/geo/            Geography build (Node, no npm deps): HDX reporting units → COD-AB / PSA PSGC
data/reference/         Small committed reference tables (crosswalks, curated decisions)
data/raw/, data/processed/  Local only, git-ignored
docs/                   Architecture, API, pipeline, geography and data-model documentation
planning/               Research plan (SIGMA_RESEARCH.md)
```

The web app is both the UI and the API; the mobile app is a second API client.
Analysis runs offline in Python, and its map output
(`web/public/data/sigma/hdx-dengue-sigma.json`) is a committed, generated file.
There is no database yet. See [docs/architecture.md](docs/architecture.md).

## Getting started

**Prerequisites:** Node.js 20+ (CI uses 20 for web, 22 for mobile), npm, and
Python 3.12 for the data pipeline.

```bash
# Web app and API — http://localhost:3000
cd web && npm ci && npm run dev

# Mobile client (set the API address in the app's Settings or in mobile/.env)
cd mobile && npm ci && npm start

# Python pipeline
pip install -r ml/requirements.txt
python ml/clean_dengue.py && python ml/ears.py   # needs the raw files in data/raw/
```

The pipeline's raw inputs are not committed; see
[docs/dengue-pipeline.md](docs/dengue-pipeline.md) for what to place in `data/raw/`.

### Environment variables

All are optional. Copy each `.env.example` and fill in what you need; never
commit the real file.

| File | Variables | Effect when unset |
| --- | --- | --- |
| [`web/.env.example`](web/.env.example) → `web/.env.local` | `GROQ_API_KEY` (server-only), `GROQ_MODEL`, `CHAT_DISABLED`, `CHAT_PUBLIC_DISABLED` | Policy Copilot answers `not_configured` |
| | `NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_STYLE` | Maps fall back to OpenStreetMap raster tiles |
| [`mobile/.env.example`](mobile/.env.example) → `mobile/.env` | `EXPO_PUBLIC_API_BASE_URL` (bundled into the app; never a secret) | Defaults to `http://localhost:3000/api/v1` |
| [`ml/.env.example`](ml/.env.example) → `ml/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | Unused today (no database yet) |

## Data sources

| Source | Status | Coverage | Used for |
| --- | --- | --- | --- |
| [OpenDengue v1.3](https://opendengue.org) | Connected | National, weekly, 30/12/2012 – 25/11/2023 (544 weeks, with gaps) | Lab, `/api/v1/dengue/*` |
| HDX Philippine Dengue Cases and Deaths (DOH Epidemiology Bureau data, via Cirrolytix), CC BY | Processed offline | 126 reporting units, weekly, 10/01/2016 – 03/01/2021 | EARS, DOH thresholds, Explore map |
| COD-AB / geoBoundaries (CC BY-IGO), PSA PSGC | Geography reference | Region → reporting unit | Joining dengue units to boundaries and codes |
| OpenStreetMap | Connected | Basemap tiles only | Map background |
| [Project CCHAIN](https://data.humdata.org/dataset/project-cchain) climate (CC BY 4.0) | Processed offline | 12 cities, weekly, 2003 – 2022 | Explore → Environment; weather covariates |
| [Open-Meteo](https://open-meteo.com/) historical weather, ERA5 (CC BY 4.0; free tier non-commercial) | Processed offline | Same 12 cities, weekly, 2008 – Oct 2026 | Explore → Environment; extends CCHAIN past 2022 |
| GDELT, Philippine news / RSS | Demo | — | Signal layers (synthetic stand-ins) |
| DOH reports, RITM | Planned | — | Not ingested |

**Known quality limitations** (detail in [docs/dengue-pipeline.md](docs/dengue-pipeline.md)
and [docs/geo/](docs/geo/README.md)):

- Reporting units are not provinces: 22 are province remainders. Values are only
  summed upward, never split.
- Missing weeks (e.g. 06/01/2019 for every unit) and 665 suspected cases↔deaths
  swap rows are treated as **no data**, never zero.
- The meaning of the HDX `date` column, whether counts are by residence, and whether
  province rows exclude their cities are **unconfirmed** assumptions.
- Zeros cannot be told apart from "no report"; long zero runs and one-week spikes are
  flagged, not corrected. National OpenDengue data has year-end reporting artefacts.
- The DOH alert and epidemic thresholds follow the PIDSR Manual of Procedures (2014,
  §5.3.5: same-week mean + 1 SD / + 2 SD) using 3 prior years, the shortest the manual
  allows; the official system may use 5 years and regional thresholds.

## API

Base URL: `/api/v1` (live: `https://datascience-2026.vercel.app/api/v1`). Read-only
JSON, no authentication. Full reference: [docs/api.md](docs/api.md) and `/documentation`.

| Endpoint | Method | Returns | `meta.status` |
| --- | --- | --- | --- |
| `/api/v1` | GET | Endpoint index | `live` |
| `/api/v1/health` | GET | Service status and configuration flags | `live` |
| `/api/v1/sources` | GET | Source catalogue | `live` |
| `/api/v1/dengue/observations` | GET | Weekly national observations | `live` |
| `/api/v1/dengue/summary` | GET | Weekly, monthly and yearly aggregates | `live` |
| `/api/v1/dengue/signals` | GET | Anomaly results | `not_connected` |
| `/api/v1/access/metrics` | GET | Medicine-access indicators | `demo` |
| `/api/v1/policy/info` | GET | Assessment areas and AI disclosure | `demo` |
| `/api/v1/policy/evidence` | GET | Curated policy evidence | `demo` |
| `/api/v1/chat` | POST | Policy Copilot | depends on configuration |

Every response uses one envelope, `{ data, meta }` or `{ error, meta }`, and
`meta.status` says what kind of data it carries:

| Status | Meaning |
| --- | --- |
| `live` | Real records from a connected source (which may still be historical) |
| `demo` | Simulated or illustrative records; `isSample` is `true` |
| `unavailable` | The capability exists but has no data right now |
| `not_connected` | The capability has not been wired to a source yet |

```bash
curl "https://datascience-2026.vercel.app/api/v1/dengue/observations?limit=2"
curl "https://datascience-2026.vercel.app/api/v1/access/metrics?medicineId=<id>&limit=10"
```

## Model maturity

| Component | State |
| --- | --- |
| Dengue cleaning, DOH thresholds, EARS C1/C2/C3 | **Implemented** in Python, run offline on 2016–2021 data, with QA reports ([docs/reports/](docs/reports/)) |
| EARS / DOH results on the map | **Implemented** as a static retrospective export on Explore |
| EARS in the API (`/dengue/signals`) | **Not connected**: returns `not_connected`, not "no outbreak" |
| ACCESS gap rule | **Implemented**, rule-based and illustrative, on **demo** data only |
| Simulate page | **Removed** (was a demo curve, not a fitted model) |
| Forecasting models (SARIMA, gradient boosting, Bayesian spatial) | **Not started**; proposed in [planning/SIGMA_RESEARCH.md](planning/SIGMA_RESEARCH.md) |
| Signal ingestion (GDELT, news) | **Demo** stand-ins; no live ingestion |

Retrospective comparison with the 2019 epidemic: EARS alarmed nationally on
26/05/2019, seven weeks before the DOH national alert, but it alarms at every season
onset, so it is a timing signal and needs the DOH threshold alongside it. See the
[EARS QA report](docs/reports/dengue_ears_qa_report.pdf).

## Checks

```bash
cd web    && npm run lint && npm run typecheck && npm run test && npm run build
cd mobile && npm run lint && npm run typecheck && npm run test
python -m compileall -q ml
```

The web tests include a registry test that checks every route file against
`/documentation`, runs each documented example against the real handler, and
pins the four data statuses. CI (`.github/workflows/validate.yml`) runs the web
and mobile lint, typecheck and tests, the web build, and a Python compile check.

## Security notes for API integrators

- No endpoint requires or accepts credentials, and there are no API keys or
  per-consumer quotas. This is a prototype deployment, not a hardened public API.
- The Copilot's provider key stays on the server; `/api/v1/chat` is rate limited
  (30 requests per 60 s per IP) and refuses with `not_configured` when no key is set.
- Branch on `meta.status` and `isSample`. Never display `demo` data as real or
  treat `not_connected` as "nothing found".
- Request limits (row caps, 16 KB body) are listed in [docs/api.md](docs/api.md#limits).

## Roadmap (incomplete work)

- Connect the EARS results to `/api/v1/dengue/signals`.
- A real ACCESS data source and provider, with a privacy review
  ([docs/access-data-model.md](docs/access-data-model.md#implementation-status-and-open-decisions)).
- Live signal ingestion (GDELT, Philippine news).
- Weather for reporting units beyond the 12 CCHAIN cities, CHIRPS rainfall past
  2022, and the fitted forecasting models from the research plan
  ([docs/environmental-covariates.md](docs/environmental-covariates.md)).
- A database (Supabase is planned but not configured).

## Documentation

| Document | Covers |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | System architecture |
| [docs/api.md](docs/api.md) | API endpoints, envelopes, limits and errors |
| [docs/dengue-pipeline.md](docs/dengue-pipeline.md) | Cleaning, DOH thresholds and EARS ([QA reports](docs/reports/)) |
| [docs/geo/](docs/geo/README.md) | Reporting units, geography method and data quality |
| [docs/environmental-covariates.md](docs/environmental-covariates.md) | Weather sources (CCHAIN, Open-Meteo), comparability, covariate plan |
| [docs/access-data-model.md](docs/access-data-model.md) | ACCESS data model, status and open decisions |
| [docs/mobile.md](docs/mobile.md) | Expo client, API address, EAS builds |
| [AGENTS.md](AGENTS.md) | Rules for contributors and AI agents |

The watercolour SIGMA logo in `web/public/brand/` is a brand asset only; the
application UI is a clean, dashboard-style design.
