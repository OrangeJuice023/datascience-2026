# SIGMA

**S**patial **I**ntelligence & **G**eographic **M**odeling for **A**ction

SIGMA is a public-health intelligence and scenario-analysis platform concept
for a hackathon project. It combines formal health data and open-source
public-health signals, identifies spatiotemporal patterns and anomalies, and
provides interactive analysis and scenario-based decision support.

> **Status:** early build. A dengue data pipeline (cleaning, DOH alert and
> epidemic thresholds, EARS C1/C2/C3 anomaly detection) is implemented in
> `ml/`; see [docs/dengue-pipeline.md](docs/dengue-pipeline.md). A versioned
> JSON API (`/api/v1`) and an Expo client for it are in place; see
> [docs/api.md](docs/api.md) and [docs/mobile.md](docs/mobile.md). The
> anomaly engine is implemented but not connected to the API, the ACCESS
> module runs on simulated records, and the Policy Copilot needs a
> server-side model provider key. Nothing here is a validated public-health
> claim.

## Core modules

| Module    | Route        | Purpose                                                        |
| --------- | ------------ | --------------------------------------------------------------- |
| TRACE     | `/lab`       | Detect and organize public-health signals.                     |
| ANALYZE   | `/explore`   | Explore trends, anomalies, spatial clusters, historical data.  |
| SIMULATE  | `/simulate`  | Explore simple spatial-temporal scenarios.                     |
| ACT       | `/`          | Present evidence and decision-support info for LGU/public-health users. |

## Project structure

```
D:\SIGMA\
  web\                Next.js + TypeScript + Tailwind frontend (App Router)
  mobile\             Expo + React Native client (iOS, Android)
  packages\
    sigma-contracts\  Type-only API contracts shared by web and mobile
  ml\                 Python environment and ML/analysis code
    .venv\            Local virtual environment (not committed)
  data\
    raw\              Raw, unprocessed data (not committed)
    processed\        Processed/derived data (not committed)
    sample\           Small sample data safe to commit for development
  scripts\            Automation / utility scripts
  docs\               Project documentation
  .github\workflows\  CI validation workflows
  .cache\             Local caches (not committed)
```

## Tech stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, App Router
- **Mobile:** Expo SDK 58, React Native, expo-router, EAS builds
- **Deployment:** Vercel (not yet configured)
- **Database:** Supabase PostgreSQL (not yet configured)
- **Maps:** MapLibre GL JS, OpenStreetMap-compatible data
- **Charts:** Recharts (web), plain React Native views (mobile)
- **Python / ML:** numpy, pandas (plus openpyxl, matplotlib and reportlab for the dengue pipeline and its QA reports)
- **Automation:** GitHub Actions

## Getting started

### Frontend

```bash
cd web
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Routes: `/`, `/explore`, `/lab`, `/simulate`, `/policy`, `/access`.

### Mobile

```bash
cd mobile
npm install
npm start
```

The app talks to the web API. The address is set in **Settings** inside the
app, or baked in with `EXPO_PUBLIC_API_BASE_URL`. The app uses the SIGMA
field-guide design system — warm paper, ink, cobalt, olive, terracotta —
defined in `mobile/src/constants/theme.ts` and documented in
[docs/mobile.md](docs/mobile.md), together with the EAS build profiles and
the APK install steps. Sigi, the maya-inspired companion, is generated
pixel-art (`web/scripts/generate-sigi-mascot.py`) and appears on the splash
and in the Overview, Dengue, ACCESS and Policy screens; it states what the
app is doing, never what the data means. The package identifier is still a
placeholder (`org.sigma.mobile`), and the API is not deployed, so an APK can
only reach a server on the same network.

### API

The web app serves a versioned JSON API under `/api/v1`. See
[docs/api.md](docs/api.md).

| Endpoint                       | Method | Returns                                  |
| ------------------------------ | ------ | ---------------------------------------- |
| `/api/v1`                      | GET    | The endpoint index                        |
| `/api/v1/health`               | GET    | Service status and configuration flags    |
| `/api/v1/sources`              | GET    | The source catalogue                       |
| `/api/v1/dengue/observations`  | GET    | Raw weekly national observations           |
| `/api/v1/dengue/summary`       | GET    | Weekly, monthly and yearly aggregates     |
| `/api/v1/dengue/signals`       | GET    | Anomaly results and open-source demo data  |
| `/api/v1/access/metrics`       | GET    | Medication access indicators               |
| `/api/v1/policy/info`          | GET    | Assessment areas and the AI disclosure     |
| `/api/v1/chat`                 | POST   | The Policy Copilot                         |

### Python / ML environment

```powershell
cd ml
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Environment variables

Copy the example files to `.env.local` (frontend), `.env` (ml) and `.env`
(mobile) and fill in the values you need. No real credentials are included in
this repository.

- [`web/.env.example`](web/.env.example) — the model provider key (server-side
  only) and the public map-tile settings.
- [`ml/.env.example`](ml/.env.example) — database connection details, still
  empty because there is no database yet.
- [`mobile/.env.example`](mobile/.env.example) — the API base URL. This is the
  only thing that may be set in the app, and it must never be a secret.

## Checks

```bash
cd web    && npm run lint && npm run typecheck && npm run test && npm run build
cd mobile && npm run lint && npm run typecheck && npm run test
python -m compileall -q ml
```

## Documentation

| Document | Covers |
| -------- | ------ |
| [docs/architecture.md](docs/architecture.md) | The high-level system architecture |
| [docs/api.md](docs/api.md) | The `/api/v1` endpoints, envelopes, limits and error codes |
| [docs/mobile.md](docs/mobile.md) | The Expo client, the API address, and the EAS build and install steps |
| [docs/dengue-pipeline.md](docs/dengue-pipeline.md) | The dengue cleaning and EARS pipeline (QA reports in [docs/reports/](docs/reports/)) |
| [docs/access-data-model.md](docs/access-data-model.md) | The ACCESS data model, which is design-only so far |
| [docs/data-sources.md](docs/data-sources.md) | What each data source is and what it is not |

## Notes

- The vintage/illustrated watercolor SIGMA logo is a brand asset only
  (`web/public/brand/`) and is not used as the application's UI style.
- The application UI itself is modern, clean, scientific, and
  dashboard-oriented.
- This is a hackathon scaffold. Nothing in this repository should be treated
  as a validated public-health claim or production-ready system.
