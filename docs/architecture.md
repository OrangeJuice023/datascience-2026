# SIGMA — Architecture (scaffold stage)

> This document describes the intended architecture direction for SIGMA.
> At this stage only the project scaffold exists — no data pipelines, ML
> models, or live integrations are implemented. Nothing below should be
> read as a description of current functionality.

## Overview

SIGMA is organized around four conceptual modules:

1. **TRACE** — detect and organize public-health signals from formal and
   open-source sources.
2. **ANALYZE** — explore trends, anomalies, spatial clusters, and historical
   patterns in collected signals.
3. **SIMULATE** — explore simple spatial-temporal scenarios.
4. **ACT** — present evidence and decision-support information for
   public-health / LGU (local government unit) users.

## High-level component map (planned)

```
                     +-------------------+
                     |     web (Next.js) |
                     |  /  /explore      |
                     |  /lab  /simulate  |
                     +---------+---------+
                               |
                               | REST / RPC (TBD)
                               v
                     +-------------------+
                     |  Supabase Postgres|
                     |  (data + auth)    |
                     +---------+---------+
                               ^
                               |
                     +---------+---------+
                     |   ml (Python)     |
                     |  ETL, analysis,   |
                     |  simulation code  |
                     +-------------------+
```

## Frontend (`web/`)

- Next.js App Router, TypeScript, Tailwind CSS.
- Route-per-module layout:
  - `/` — Overview (ACT)
  - `/lab` — TRACE
  - `/explore` — ANALYZE
  - `/simulate` — SIMULATE
- Maps rendered with MapLibre GL JS against OpenStreetMap-compatible tiles.
- Charts rendered with Recharts.
- Deployment target: Vercel (not yet configured).

## Data layer

- Supabase PostgreSQL is the planned system of record for processed signals,
  clusters, and scenario runs (not yet configured).
- Raw data lives under `data/raw/` (not committed); processed/derived data
  under `data/processed/` (not committed); small illustrative samples under
  `data/sample/` may be committed for local development.

## Python / ML (`ml/`)

- Local virtual environment at `ml/.venv/` (not committed).
- Planned libraries: pandas, numpy, scikit-learn, statsmodels, geopandas,
  shapely.
- Intended responsibilities: data ingestion/cleaning, anomaly detection,
  spatial clustering, and scenario simulation logic. None of this is
  implemented yet.

## Automation

- GitHub Actions under `.github/workflows/` runs basic validation
  (lint/build/typecheck) on push/PR. No deployment or data-processing
  automation is configured yet.

## Open questions / not yet decided

- Exact schema for signals, clusters, and scenarios in Supabase.
- Which open-source public-health signal sources will be integrated, and how.
- Authentication/authorization model for public-health/LGU users.
- Hosting/scheduling approach for any future ML batch jobs.
