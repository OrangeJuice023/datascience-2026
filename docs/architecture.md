# SIGMA — Architecture

> Hackathon prototype. One real formal data source (OpenDengue, national,
> historical) flows through the app; open-source signals, anomaly outputs and
> simulations are still demo data. Nothing here is a validated public-health
> claim.

## Overview

SIGMA is organized around four conceptual modules:

1. **TRACE** — find and organize public-health signals.
2. **ANALYZE** — understand trends, anomalies and spatial patterns.
3. **SIMULATE** — explore assumption-driven scenarios.
4. **ACT** — support verification and LGU/public-health decision-making.

| Route       | Page            | Evidence shown today                                   |
| ----------- | --------------- | ------------------------------------------------------ |
| `/`         | Overview        | Formal summary (real) + demo signal landscape          |
| `/explore`  | Signal Explorer | Analytical map: formal readout, demo signals/model     |
| `/lab`      | SIGMA Lab       | Real OpenDengue national series; demo LGU signal tabs  |
| `/access`   | ACCESS          | Demo medicine availability, search demand, access gaps |
| `/simulate` | Simulate        | Demo scenario model                                    |
| `/policy`   | Policy          | Demo assessment areas                                  |

## Evidence categories (never mixed)

| Category | Type in `web/src/types/data.ts` | UI badge | Status |
| --- | --- | --- | --- |
| A. Formal health observation | `HealthObservation` | FORMAL | OpenDengue national weekly — **connected** |
| B. Event-based signal | `PublicHealthSignal` + `SignalSource` | SIGNAL | Demo only |
| C. Environmental / access covariate | planned `EnvironmentalCovariate` | CONTEXT | Planned |
| D. Geographic reference | `GeographicEntity` | — | Geography track (PSGC/GADM) in progress |
| E. Model output | `AnomalyResult`, `ForecastResult`, `TrendSeries` | MODEL | Demo on signals; **none fitted on formal data** |

A signal is not a case count, a model score is not a diagnosis, and a
national observation is never drawn as a sub-national layer.

## Data flow

```
OpenDengue v1.3 Temporal extract (WPRO)
        │  scripts/build_opendengue.py        (data track: download, filter, validate)
        ▼
data/processed/opendengue/ph_weekly_national_2012_2023.csv   (canonical, 544 rows)
        │  web/scripts/build-opendengue.mjs   (re-validates; deterministic; records input SHA-256)
        ▼
web/src/data/opendengue-ph.json               (committed frontend fixture)
        │  OpenDengueProvider (server-only)
        ▼
HealthObservation[]                           (typed, with per-row provenance)
        │  lib/national-observations.ts       (gap detection, stats, MMWR weeks)
        ▼
Server Components → compact serialized series → Client charts / map
```

Raw datasets never reach the browser: providers are `server-only`, pages load
data in Server Components, and only shaped arrays are serialized.

## Provider architecture

```
UI (Server Components)
  ↓
DataProvider  (web/src/data/provider.ts)
  ├─ DemoDataProvider        demo signals, LGUs, trends; no observations
  ├─ OpenDengueProvider      real national observations + demo for the rest
  └─ SupabaseDataProvider    future
```

`getAnomalyResults()` returns `[]` until a model has actually been fitted; the
UI then shows "Model not yet fitted" instead of any score.

## OpenDengue: which extract and why

Reconciled by the data track in `planning/OPENDENGUE_RECONCILIATION.md`.
OpenDengue v1.3 publishes several extracts; for the Philippines:

| Extract | PH national weekly rows | Coverage |
| --- | --- | --- |
| National | 149 | 2013, 2022–2023 only (previously bundled; now removed) |
| Temporal (WPRO) | 544 | 2012-12-30 → 2023-11-25 |

SIGMA uses the Temporal extract, filtered to `ISO_A0 = PHL`, `T_res = Week`,
`S_res = Admin0`. The frontend generator refuses to write its fixture unless
the canonical CSV matches the reconciliation: 544 rows, 2012-12-30 →
2023-11-25, geography `ph` / national, case definition `total`, sum 1,911,372,
max 21,743. Known facts, all surfaced in the Lab:

- The series is not continuous: 25 missing weeks in 7 gaps. Missing weeks are
  absent, never zero-filled or interpolated; charts break at them.
- Case definition: `Total` for every row.
- Weekly rows come from mixed upstream origins (record-id prefixes `WHOWPRO`, `MOH`).
- Per the reconciliation, OpenDengue methods allow gaps of up to 6 weeks to be
  imputed upstream; the extract does not flag which weeks, if any, were.
- Annual totals are shown only for epi years with every week recorded.
- Sub-national PH rows (Admin1/Admin2) exist in the Temporal/Spatial extracts.
  They are **Phase 2** and not integrated. Observations carry their own
  `geographyId` / `geographicLevel`, so such a file can be added later without
  frontend redesign.

## Map

MapLibre GL JS + deck.gl overlay; MapTiler basemap via
`NEXT_PUBLIC_MAPTILER_KEY` with a key-less OpenStreetMap fallback. 2D / 3D /
Globe views, mode registry (`web/src/lib/map/modes`), timeline and
config-driven legend. The Disease mode shows a national readout, not a
spatial layer, because no sub-national formal data is connected. The Access
mode (demo) draws facility availability/freshness points, a search-demand
heatmap and area-level potential access gaps; see
[access-data-model.md](access-data-model.md).

## Event-signal pipeline (planned)

Typed contract in `web/src/lib/signals/pipeline.ts`; nothing is scraped yet.

```
News / RSS / GDELT → text extraction → disease extraction → location extraction
→ date/event extraction → deduplication → PSGC resolution
→ PublicHealthSignal → TRACE → spatiotemporal analysis
```

The formal-data provider is not responsible for any of these stages.

## Model roadmap

| Level | Model | Status |
| --- | --- | --- |
| 1 | Seasonal / historical baseline | Not started |
| 2 | Farrington / EARS-style anomaly detection | Not started |
| 3 | Forecasting baseline (SARIMA / Holt-Winters, rolling-origin backtests) | Not started |
| 4 | XGBoost or comparable ML benchmark | Not started |
| 5 | Spatiotemporal model (needs reconciled sub-national formal data) | Not started |
| 6 | Scenario simulation (assumption-driven, never a forecast) | Demo prototype only |

Model code should consume `toObservationFrame()` (in
`web/src/lib/national-observations.ts`): one row per observation, ordered by
disease, geography, resolution and period — or the same frame exported for
the Python side. It must never read UI component state.

## Still open

- Supabase schema and hosting for processed records and model runs.
- Which open-source signal sources are onboarded first, and how.
- Sub-national formal data: reconciliation of OpenDengue region/province rows.
- Authentication model for LGU / public-health users.
