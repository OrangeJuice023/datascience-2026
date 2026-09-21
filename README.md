# SIGMA

**S**patial **I**ntelligence & **G**eographic **M**odeling for **A**ction

SIGMA is a public-health intelligence and scenario-analysis platform concept
for a hackathon project. It combines formal health data and open-source
public-health signals, identifies spatiotemporal patterns and anomalies, and
provides interactive analysis and scenario-based decision support.

> **Status:** initial scaffold only. No live data sources, scraping,
> ML models, simulations, or policy logic are implemented yet. All
> dashboard content is placeholder UI.

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
- **Deployment:** Vercel (not yet configured)
- **Database:** Supabase PostgreSQL (not yet configured)
- **Maps:** MapLibre GL JS, OpenStreetMap-compatible data
- **Charts:** Recharts
- **Python / ML:** pandas, numpy, scikit-learn, statsmodels, geopandas, shapely
- **Automation:** GitHub Actions

## Getting started

### Frontend

```bash
cd web
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Routes: `/`, `/explore`, `/lab`, `/simulate`.

### Python / ML environment

```powershell
cd ml
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Environment variables

Copy `.env.example` files to `.env.local` (frontend) / `.env` (ml) and fill in
values as needed. No real credentials are included in this repository.

## Documentation

See [docs/architecture.md](docs/architecture.md) for the high-level system
architecture.

## Notes

- The vintage/illustrated watercolor SIGMA logo is a brand asset only
  (`web/public/brand/`) and is not used as the application's UI style.
- The application UI itself is modern, clean, scientific, and
  dashboard-oriented.
- This is a hackathon scaffold. Nothing in this repository should be treated
  as a validated public-health claim or production-ready system.
