# Environmental covariates and scenario analysis (Physics 3)

> **Status, 2026-10-18.** Sources verified, raw data downloaded, alignment
> analysis done, aligned city-week tables built. **No model has been fitted
> and no scenario output exists.** The input schema and output contract at the
> end of this document are a **proposal for team review**; nothing downstream
> (hub ENVIRONMENT tab, `web/`) should be built against them until agreed.
>
> **Update, 2026-10-19.** Pipeline reproducibility verified. `fetch`, `build`
> and `crosscheck` share one path layout (`ml/environment/paths.py`: one
> `data/raw/<source>/manifest.json` per source). `build` and `crosscheck` check
> every raw file against its manifest SHA-256 before writing anything, and both
> outputs record their inputs. A clean-copy run (empty `data/`, fresh download
> of all 5 files including the 570 MB `climate_atmosphere.csv`, about 1 h 45 min)
> gave raw files byte-identical to the 2026-10-18 download, city-week CSVs
> byte-identical to the 2026-10-18 build, and the same quality report and
> crosscheck (best offset −13 d, 9 modeling cities). Only the `inputs`
> provenance block changed format.
>
> **Update, 2026-10-20. Two weather sources, one week, one geography key.**
> CCHAIN is the primary weather source for modeling; Open-Meteo (ERA5) extends
> it past 2022 and to LGUs outside CCHAIN. Decided: Sunday–Saturday MMWR weeks
> (§4.2) and COD-AB pcodes as `geography_id` (§4.6). Both sources are built on
> the same city-week grid (`city_weekly_weather.csv`, one row per city × week
> × source) and compared on their 2008–2022 overlap (§4.7). Temperature and
> humidity agree; **rainfall does not** (CHIRPS vs ERA5), so rainfall is never
> substituted across sources (§4.8). The hub ENVIRONMENT tab and the web
> `EnvironmentalObservation` contract now carry this table (§9).
> `python -m environment.validate` passes all 34 checks, and a full rebuild
> reproduces every output byte for byte. Still no model fitted.
>
> **Update, 2026-10-23. Canonical geography ids.** The geography track (PR #3,
> now on `main`) set SIGMA's canonical ids, so `geography_id` is now the slug
> id, e.g. `davao-city`, instead of the CCHAIN pcode (§4.6). The CCHAIN pcode,
> PSA PSGC code and HDX reporting unit are kept as columns. Every weekly value
> is unchanged; only the key changed. `environment.validate` now runs 36
> checks, all passing.
>
> **Update, 2026-10-23. Environment map mode.** The Explore page's Environment
> tab is live (`web/src/lib/map/modes/environment.ts`,
> `web/src/components/maps/environment-detail-panel.tsx`). It shows the 12
> CCHAIN cities, one weather variable and **one source at a time**, on a weekly
> timeline. The two sources are never spliced. Incomplete weeks are drawn as no
> data, and provisional ERA5T weeks are faded. Selecting a city shows both
> sources side by side and a 3-year chart with one line per source. Palayan and
> Legazpi carry a warning not to compare their weather with their province's
> HDX counts. The weather JSON is a separate chunk loaded only when the tab
> opens.
>
> Nothing here establishes that weather causes dengue. Every relationship this
> track estimates is a conditional association in observational data.

## 1. Summary

- **Use Project CCHAIN (HDX, CC BY 4.0) as the primary source.** It is the only
  verified open source that already ships city-weekly PIDSR dengue counts
  *and* barangay-daily climate for the same places (12 cities, 2008–2022).
  Climate variables come from ERA5 (temperature, humidity) and CHIRPS
  (rainfall), selected by CCHAIN after comparison with PAGASA stations.
- **Usable for modeling: 9 cities.** Palayan and Legazpi are too sparse
  (median 1 case/week). Iloilo City is excluded because its PIDSR series is
  actually Iloilo *province* (§4.3).
- **Alignment is feasible but not exact.** The week label is uncertain by about
  one week (§4.2), several cities have long runs of zeros that look like
  reporting gaps (§4.4), and 2020–2022 is disrupted by COVID-19.
- **Temperature carries little independent spatial information.** Within a
  city there are only 1–25 distinct ERA5 values per day, so it is essentially
  one 0.25° grid cell per city. Rainfall (CHIRPS, 0.05°) varies more.
- **A scenario prototype is justified only if it passes the evaluation gate
  in §7.** That gate is out-of-sample: climate terms must improve on a
  seasonality + recent-cases baseline in a rolling-origin backtest. If they do
  not, the honest output is "no added value from these covariates", and no
  scenario tool ships.

## 2. Source inventory (checked against publishers on 2026-10-18)

| Source | What | Spatial res. | Temporal res. / coverage | Licence / access | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Project CCHAIN** `climate_atmosphere` (HDX `project-cchain`) | tave/tmin/tmax, heat index, RH, wind, solar/UV (ERA5); rainfall (CHIRPS) | Barangay zonal stats of 0.25° ERA5 / 0.05° CHIRPS | Daily, 2003-01-01 → 2022-12-31, 12 cities | CC BY 4.0 (HDX). ERA5 UTC shifted +8 h to PHT; daily mean 00–23 PHT | **Primary.** Downloaded; 0 missing temp/RH; 1 Zamboanga barangay has no rainfall (CHIRPS is land-only) |
| **Project CCHAIN** `disease_pidsr_totals` | DOH-PIDSR weekly cases, 9 diseases incl. dengue | City (adm3) | Weekly (Monday dates), 2008-01-07 → 2022-12-26 | CC BY 4.0; data "governed by Data Use Agreements that allows for public use for climate and health applications" (HDX resource text) | **Primary outcome** for this track. Downloaded |
| Project CCHAIN `climate_indices`, `climate_land` (NDVI), `climate_atmosphere_downscaled` | SPI-type rainfall indices; NDVI (MODIS MCD19A3CMG); 0.02° downscaled tmin/tmax/rain | Barangay | Daily/monthly | CC BY 4.0 | **Later.** Downscaled output: CCHAIN itself advises the standard table "if you are uncertain" |
| **HDX DOH-Epi Dengue 2016–2021** (Cirrolytix) | DOH-EB weekly cases and deaths | Province / HUC (126 locations) | Weekly (Sunday dates), 2016-01-10 → 2021-01 | CC BY 4.0 | **Cross-check only** for this track (no climate attached); primary for the EARS track |
| CHIRPS (UCSB CHC), direct | Rainfall | 0.05° | Daily, 1981 → near present, 50°S–50°N | Public domain ("waived all copyright", CHC). **v2 production ends after Dec 2026; v3 now available** | Needed only to extend beyond 2022 or the 12 cities |
| ERA5 single levels (Copernicus CDS), direct | Temperature, humidity, etc. | 0.25° | Hourly, 1940 → present; ERA5T latency ~5 days, final ~2–3 months | CC BY (CDS page); needs CDS account | Same as above |
| Open-Meteo historical API | ERA5 reanalysis served as point time series | One 0.25° ERA5 cell (`models=era5`, `elevation=nan`) | Daily (PHT), 1940 → ~6 days ago | Data CC BY 4.0; **free tier non-commercial only**, < 10 000 calls/day | **Extension source** (decided 2026-10-20): after 2022 and for LGUs outside CCHAIN. Fetched 2007-12-30 → 2026-10-10 for the 12 CCHAIN cities. Pinned to ERA5 only (the default `best_match` blends ERA5-Land and IFS from 2017). Rainfall is ERA5, not CHIRPS (§4.7) |
| NASA POWER daily API | Rain (PRECTOTCORR), T2M, etc. | MERRA-2 native grid (API header: source MERRA2) | Daily; tested 2022 call returns data | Licence not stated on the API page checked; **unverified** | Optional sensitivity check (independent reanalysis) |
| PAGASA station data | Station rainfall, temperature, RH | Station points | Daily | By request: letter + signed CADS-07 terms of use; free for non-commercial/academic at PAGASA's discretion; **use limited to the stated purpose** | Gold standard for validation, but slow to obtain and not redistributable by default. Request only if the gate in §7 is passed |
| NOAA CPC ONI (ENSO) | Niño-3.4 SST anomaly, 3-month running mean | Basin-wide | Monthly-seasonal, 1950 → JAS 2026 (latest JAS 2026 = **+2.16**) | US Gov public data | **Context only.** One national series, cannot explain city differences |
| WorldPop (via CCHAIN) | Population count per barangay | ~100 m → barangay | Annual, 2000–2020 | CC BY 4.0 | Used only as within-city weights (2020) |

Not verified and therefore not proposed: any "mosquito index" or
larval-survey series (none found as open, machine-readable PH data), and
flood/hazard layers as time-varying covariates (Project NOAH in CCHAIN is
static hazard area, not events).

## 3. Feasibility

| Question | Answer |
| --- | --- |
| Do environmental and dengue data exist for the same places and weeks? | Yes, for 12 CCHAIN cities, 2008–2022 (dengue) × 2003–2022 (climate). Not for the HDX province series without new climate extraction. |
| Can they be joined without guessing? | Yes. Both are keyed by PSGC-style codes (`adm3_pcode`, `adm4_pcode`) and calendar dates. |
| Is the sample large enough? | 9 usable cities × 636 pre-COVID weeks (2008-01 → 2020-03). That is adequate for city-level seasonal models; it is thin for estimating lag-specific effects city by city. |
| Can it say anything outside the 12 cities? | No. Effects estimated here do not transfer to other LGUs without new data. |
| Can it run in near-real time? | Not with CCHAIN (ends 2022). It would need direct CHIRPS v3 + ERA5T ingestion and current PIDSR data, which we do not have. |

## 4. Alignment analysis

Reproduce from `ml/`:

```
python -m environment.fetch       # HDX files -> data/raw/<source>/ + manifest.json
python -m environment.geography   # geography.csv (ids, centroids, HDX names)
python -m environment.open_meteo  # ERA5 per city-year -> data/raw/open_meteo/ + manifest.json
python -m environment.build       # city_weekly_dengue.csv, city_weekly_weather.csv, quality_report.json
python -m environment.crosscheck  # crosscheck.json (HDX vs CCHAIN, checks the HDX week offset)
python -m environment.compare     # weather_comparability.{json,csv}
python -m environment.export --hub ../DATASCIENCE_MASTER_DATA_HUB.xlsx
                                  # hub_environment.csv, hub ENVIRONMENT tab, web JSON
python -m environment.validate    # 36 checks; non-zero exit on failure
```

The first Open-Meteo fetch is 240 requests (12 cities × 20 years) and took
about 6 minutes on 2026-10-20 without hitting the rate limit. Cached chunks are
reused; a chunk is re-fetched only if its city's coordinates or the pinned
date range change.

`build` and `crosscheck` stop before writing anything if a manifest is missing
or a raw file no longer matches its manifest SHA-256. Each output records the
inputs it used (`inputs`: sha256, retrieval time, upstream last_modified, URL).
Outputs land in `data/processed/environment/`.

### 4.1 Grid

- Dengue: complete Sunday-week grid per city (§4.2). Weeks absent upstream
  stay absent (`status = absent_upstream`). Two weeks are absent in every
  city: **2012-12-30 and 2017-12-31** (CCHAIN labels 2012-12-31 and
  2018-01-01), both year-boundary weeks.
- Weather, CCHAIN: daily barangay values → population-weighted city mean
  (WorldPop 2020 weights) → Sunday-week.
- Weather, Open-Meteo: daily values at one ERA5 cell → Sunday-week.
- Both: weekly rainfall is the 7-day sum, the other variables are 7-day means
  of the daily mean/min/max. A weekly value needs all 7 days; otherwise it is
  left empty and the row is flagged `incomplete_week`. Only weeks fully inside
  a source's date range are emitted.

### 4.2 Week convention (decided 2026-10-20)

**Canonical week: Sunday–Saturday, keyed by `period_start` (Sunday) and
`period_end` (Saturday), numbered by the MMWR rule** (epi year = calendar year
of the week's Wednesday; `environment/weeks.py`). This is what the hub already
uses (HEALTH_OBSERVATIONS 2012-12-30 → 2013-01-05; DATA_DICTIONARY example)
and what HDX DOH-Epi dates fall on, so the environment track now matches the
rest of SIGMA instead of the other way round.

- Weather is daily, so it is aggregated straight onto these weeks. No offset.
- Weekly dengue labels move by a fixed offset per source
  (`weeks.SOURCE_WEEK_OFFSET_DAYS`): **CCHAIN Monday − 1 day** (the Sun–Sat week
  sharing 6 of its 7 days), **HDX Sunday − 14 days** (empirical, below). The
  original CCHAIN label is kept in `source_week_label`.
- `crosscheck` re-derives the HDX offset on canonical weeks every run and
  fails if it no longer matches the configured one.

The remaining uncertainty is about the *meaning* of a label, not the
convention. Matching the 10 shared cities over 2016–2020, the best alignment
is **HDX date − 14 days = canonical week** (mean r = 0.83; −7 days gives
0.81). This is the same as the earlier result of HDX − 13 d = CCHAIN Monday. Exact count matches are
only 2–32% at any offset, so these are different extracts or reporting
vintages, not copies. Whether CCHAIN's Monday means week start, and whether it
refers to onset, consultation or report week, is **not documented**.
Consequence: climate lags are uncertain by about one week, so results will be
reported for lag *windows* (e.g. 0–3, 4–7, 8–12 weeks), not single lags.

### 4.3 Iloilo City is really Iloilo province (excluded)

CCHAIN "Iloilo City" dengue vs HDX at the best offset: against HDX *Iloilo
province*, r = 0.993 and volume ratio 0.99; against HDX *Iloilo City*,
r = 0.948 and ratio 5.4. Yearly totals agree too (2019: 22 783 CCHAIN vs
23 062 province vs 3 382 city). The CCHAIN climate for Iloilo comes from the
180 city barangays only, so cases and weather would describe different areas.
For contrast, Tacloban matches HDX Tacloban City (r = 0.988, ratio 1.00).
Recorded in `build.py:SPATIAL_MISMATCH`.

### 4.4 Zeros that are probably missing reports

The published PIDSR table has **no missing values**, and CCHAIN's own
prototype notebook zero-fills cases (`01-prepare-central-health-data.ipynb`,
`fillna(0)`), so a zero cannot be read as "no cases". Runs of ≥ 4 zero weeks
in cities whose typical week is not near zero are flagged
`suspected_reporting_gap` (181 city-weeks). The worst are Tacloban (38 weeks
from 2016-01-04, also zero in DOH-Epi, so the gap is upstream at DOH) and
Muntinlupa/Navotas in 2020 (18 and 22 weeks, COVID period). These weeks are
excluded from fitting and scoring, never imputed.

### 4.5 Usable cities (unchanged)

Dagupan, Mandaue, Tacloban, Zamboanga, Cagayan de Oro, Davao, Mandaluyong,
Navotas, Muntinlupa. Fit window: 2008-01 → 2020-03-15. The 2020-03-16 →
2022 period is tagged `covid_disruption` and is reported separately, not
pooled.

### 4.6 Geography key (decided 2026-10-20, changed 2026-10-23)

**`geography_id` = SIGMA canonical id** from the geography track, e.g.
`davao-city` (`data/reference/geo/geography_hub_rows.csv`). Until 2026-10-23
this track used CCHAIN's 2016 COD-AB pcode (`PH112402000`). That code is still
how CCHAIN files are keyed, so it stays as `cchain_adm3_pcode` and is
translated on read.

Every cross-source join lives in one tracked file,
`ml/environment/geography_crosswalk.csv`: canonical id, CCHAIN pcode, COD-AB
v03 pcode, PSA PSGC code, HDX reporting unit and relation, and the HDX DOH-Epi
location and province names. The ids and codes are copied from the geography
track's `data/reference/geo/cchain_city_crosswalk.csv`. `environment.geography`
stops if they drift from it or from `geography_hub_rows.csv`.

| Relation | Cities | geography_id | Rule |
| --- | --- | --- | --- |
| `same_area` | 10 | the HDX unit id, e.g. `davao-city` | weather and HDX counts describe the same area and can be joined |
| `inside_unit` | Palayan (in `nueva-ecija`), Legazpi (in `albay`) | `palayan-city`, `legazpi-city` | never join city weather to the province's HDX counts |

`palayan-city` and `legazpi-city` follow the same naming but are not rows in
`geography_hub_rows.csv`, because no HDX series reports them separately.

`environment.geography` builds `geography.csv` from the crosswalk, with
province/region names, barangay count, WorldPop 2020 population and the
**population-weighted centroid of barangay polygons** (CCHAIN
`brgy_geography`). Open-Meteo is queried at that centroid.

To add an LGU outside CCHAIN, add a crosswalk row with its canonical id,
name, PSGC code, HDX unit, a centroid and `coordinate_source` (a named,
verified source). Nothing is geocoded from a name. The hub GEOGRAPHY tab is
seeded by the geography track, not by this one.

### 4.7 Are CCHAIN and Open-Meteo comparable? (2026-10-20)

`environment.compare`, 12 cities, canonical weeks 2007-12-30 → 2022-12-31
(~780 weeks per city). Figures are for the 9 modeling cities.
"Window r" is the correlation of 0–3-week window means of standardised
anomalies, which is what the model will see. "Disagreement SD" is the SD of
the difference in those windows, in SD units.

| Variable | Raw weekly | Window r (median / min) | Disagreement SD | Verdict |
| --- | --- | --- | --- | --- |
| Mean temperature | bias −0.31 … +0.26 °C, r ≥ 0.985 | 0.994 / 0.979 | 0.08 | raw interchangeable |
| Min temperature | bias −0.77 … +0.22 °C, r ≥ 0.976 | 0.996 / 0.965 | 0.07 | anomaly interchangeable |
| Max temperature | bias +0.03 … +0.58 °C, r ≥ 0.977 | 0.992 / 0.980 | 0.09 | anomaly interchangeable |
| Relative humidity | bias +0.1 … +3.0 pp, r 0.92–0.98 | 0.947 / 0.918 | 0.24 | anomaly interchangeable |
| **Rainfall** | **ratio 0.67–1.74, r 0.51–0.85** | **0.707 / 0.644** | **0.46** | **not interchangeable** |

Why:
- **Temperature/humidity are the same product.** Both are ERA5. The residual
  bias is spatial: one grid cell vs a population-weighted barangay average.
  It is largest in the big, hilly cities (Cagayan de Oro tmin −0.77 °C,
  Davao tmax +0.58 °C).
- **Rainfall is a different product.** CCHAIN uses CHIRPS (0.05°,
  satellite + gauge); Open-Meteo uses ERA5 (0.25°, model). ERA5 drizzles: at
  Tacloban it has rain >1 mm on 75% of days vs CHIRPS 50%. Its totals are
  −33% to +74% off by city. Daily correlation peaks at lag 0 (Davao 0.36,
  Mandaluyong 0.49, Tacloban 0.54), so this is not a day-boundary artifact.
  No per-city rescaling can repair a weekly r of 0.5–0.85.
- Thresholds (`compare.GATE`) are project choices, not published standards:
  raw needs |bias| ≤ 0.5 °C / 3 pp (rain ratio 0.9–1.1) and r ≥ 0.95 in
  every modeling city. Anomaly needs window r ≥ 0.8 in every city and median
  ≥ 0.9.

What a disagreement SD means for model output: a term β per SD of a window
moves log expected cases by about β × SD just from switching source. For
rainfall at 0.46, a β of 0.1 is about ±5% in expected cases from the source
alone. For temperature it is under 1%.

### 4.8 Source policy (enforced in `environment/features.py`)

1. **Rows, not columns.** ENVIRONMENT keeps one row per city × week × source.
   No row or column mixes sources.
2. **Anomalies within source.** Model inputs are standardised anomalies
   against the *same source's* week-of-year climatology, fitted on the
   training window only (validated: removing later data does not change
   earlier anomalies). Level and variance differences cancel.
3. **Primary first.** `model_inputs` takes CCHAIN wherever it has data and
   Open-Meteo only where CCHAIN does not (after 2022, or non-CCHAIN LGUs).
   Every row keeps `source_id`, and windows that straddle the 2022/23 splice
   are flagged `mixed_source_window`.
4. **No rainfall substitution.** In a spliced series, variables with verdict
   `not_interchangeable` (rainfall) are left empty on Open-Meteo rows. Rainfall
   past 2022 or outside CCHAIN therefore needs CHIRPS itself (UCSB CHC,
   public domain; v2 ends Dec 2026, v3 available), which is **not yet
   ingested**. A single-source run (`sources=["open_meteo"]`, ERA5 rain
   everywhere) is internally consistent and allowed, but it is a different
   model from the CCHAIN one and must be labelled as such.
5. **Recent weeks are provisional.** Open-Meteo weeks within 92 days of
   retrieval are ERA5T and flagged `provisional_era5t` (confidence LOW).

## 5. Proposed modeling approach

### 5.1 Statistical model (primary)

For city *c*, week *t*, observed cases *y*:

```
y[c,t] ~ NegativeBinomial(mu[c,t], theta)
log mu[c,t] = a[c] + s_c(week_of_year) + f_c(year)                 # seasonality + slow trend
            + rho * log(1 + y[c,t-h..t-h-3])                       # recent cases, h = horizon
            + sum_w beta_R[w] * R_anom[c, window w]                # rainfall anomaly, lag windows
            + sum_w beta_T[w] * T_anom[c, window w]                # temperature anomaly
```

- **Anomalies, not raw values.** `R_anom` and `T_anom` are departures from the
  city's own week-of-year climatology computed on the training window only.
  Raw rainfall is almost collinear with the seasonal term.
- Lag windows: 0–3, 4–7 and 8–12 weeks (biologically plausible range for
  rainfall → breeding → infection → report; see §5.3).
- Partial pooling across the 9 cities for `beta` (hierarchical, or a fixed
  effect plus city interaction tested by likelihood ratio). City-specific
  seasonality is kept.
- Comparison models, all scored identically:
  - **M0:** seasonal climatology only
  - **M1:** M0 + recent cases
  - **M2:** M1 + climate anomalies
  - **M2-perm:** M2 with climate anomalies permuted across years, as a check on spurious fit
- Library: `statsmodels` GLM (already in `ml/.venv`).

### 5.2 Physical / mechanistic component (secondary, interpretability only)

A temperature-suitability index from published *Aedes aegypti* thermal
performance curves (e.g. Mordecai et al. 2017, PLOS NTD, relative R0(T);
**parameters to be verified from the paper before use**). It would be used
only as an alternative temperature term in M2. Philippine city mean
temperatures sit near the curve's optimum, so the index is expected to vary
little. That is a reason it may add nothing, and we would report it as such.

### 5.3 Assumptions (explicit)

1. Associations are conditional on seasonality and recent cases. They are not causal effects. Unmeasured drivers such as serotype shifts, immunity, vector control, water storage and mobility are absent.
2. Reporting behaviour is stable within the fit window, apart from the flagged gaps. The 2019 national epidemic declaration and COVID clearly violate this. The first is kept and tested in a sensitivity analysis; the second is excluded.
3. City-level, population-weighted reanalysis/satellite values represent exposure. ERA5 at 0.25° gives at most a few cells per city.
4. Effects are log-linear in the anomaly within the observed range. No extrapolation is made outside the observed range of each city.
5. Population is treated as constant (offset not used), because no year-specific denominator is available beyond WorldPop 2020. Inference is on counts, so slow population change is absorbed by `f_c(year)`.
6. The week label is uncertain by ±1 week (§4.2).

## 6. Scenario-analysis prototype (gated on §7)

**Question it answers:** "Given the model's fitted associations, how would
*expected* cases over the next *k* weeks in city *c* differ if rainfall /
temperature anomalies over the preceding weeks were X instead of typical?"

- Output is a **ratio vs. the climatology-only expectation** with a 90 %
  interval from parameter uncertainty (bootstrap over seasons), never an
  absolute case forecast.
- Input sliders are bounded to each city's observed 5th–95th percentile
  anomaly range. Outside that range the tool refuses to answer.
- ONI is shown as context text only, not as an input.
- Every result carries the label "Illustrative scenario from historical
  associations, 2008–2020, 9 cities. Not a forecast and not causal."
- If M2 does not pass §7, the tool is not built. The Simulate page keeps its
  current demo banner, and this document records the negative result.

## 7. Evaluation criteria

Rolling-origin backtest, expanding window. First origin 2014-01, then every
4 weeks to 2020-03. Horizons 1, 2 and 4 weeks. All climatologies and anomalies
are recomputed from training data at each origin, with no look-ahead.

| Criterion | Pass condition for the climate model (M2 vs M1) |
| --- | --- |
| Mean log score (NB predictive) | Better in ≥ 6 of 9 cities, pooled improvement with block-bootstrap 90 % CI excluding 0 |
| MAE on cases | Not worse than M1 by > 5 % in any city |
| 90 % interval coverage | 0.85–0.95 |
| Permutation check | M2 beats M2-perm. Otherwise the gain is fit to noise |
| Coefficient stability | Sign of each lag-window effect is stable across ≥ 80 % of origins |
| Out-of-period check (descriptive) | Same scores on 2020-03 → 2022, reported separately, not used for the gate |
| **Source-swap check** | Refit M2 on the same cities and weeks with `sources=["open_meteo"]`. Temperature/humidity coefficients must keep sign and overlap 90 % CIs with the CCHAIN fit. If the log-score gain differs between the two, the difference is attributed to the source, not reported as a climate effect. Any Open-Meteo-only city or period is reported separately from CCHAIN results |

Reported regardless of outcome: per-city scores, coefficient tables with CIs,
flagged-week counts, and the list of excluded cities with reasons.

## 8. Uncertainty register

| Source of uncertainty | Size / handling |
| --- | --- |
| Week label / reporting delay | ±1 week, so lag windows are used, not single lags |
| Zero-filled reports | 181 flagged weeks excluded; unflagged short gaps (< 4 weeks) remain and may bias toward 0 |
| Spatial mismatch | Iloilo excluded; other cities validated against DOH-Epi only for 2016–2020 |
| Reanalysis representativeness | ERA5 0.25°, CHIRPS 0.05°; CCHAIN's PAGASA comparison not re-done here |
| Parameter uncertainty | Bootstrap over seasons; reported as intervals |
| Model structure | M0/M1/M2 comparison; mechanistic index as alternative |
| Non-stationarity | COVID excluded; 2019 epidemic sensitivity run |
| Generalisation | 9 cities only; not transferable |
| Weather source | Temperature/RH: window disagreement 0.07–0.24 SD. Rainfall: 0.46 SD, so it is not substituted (§4.7–4.8). Open-Meteo is one ERA5 cell, not an area mean |

## 9. Input schema and output contract

### 9.1 Hub ENVIRONMENT tab (implemented 2026-10-20)

The old tab (`date, latitude, longitude, temperature_c, …`) assumed daily point
weather from one source. It is replaced by one row per **geography × week ×
source**, written by `python -m environment.export --hub` (24 276 rows: CCHAIN
12 516, Open-Meteo 11 760). Do not hand-edit it; rebuild it.

`geography_id, geography_name, geographic_level, period_start, period_end,
epi_year, epi_week, temporal_resolution, source_id, upstream_product,
aggregation_method, precipitation_mm, temperature_mean_c, temperature_min_c,
temperature_max_c, humidity_mean_pct, days_observed, qc_flag, confidence,
coverage_start, coverage_end, grid_cell, source_url, retrieved_at, as_of_date,
evidence_type, is_sample, notes`

- **Coverage:** `coverage_start` / `coverage_end` per geography × source
  (CCHAIN 2003-01-05 → 2022-12-31; Open-Meteo 2007-12-30 → 2026-10-10).
- **Quality:** `days_observed` (0–7), `qc_flag` (`ok`, `incomplete_week`,
  `range_check_failed`, `rain_partial_area` (all of Zamboanga: one coastal
  barangay has no CHIRPS rain), `provisional_era5t`), and `confidence`. CCHAIN
  ok rows are HIGH. Open-Meteo rows are MEDIUM, because they are a single cell
  and rainfall is not comparable. Provisional or incomplete rows are LOW.
- **Long-by-source, wide-by-variable.** One row per source keeps sources
  apart and makes the overlap directly comparable. Variables as columns keep
  the tab readable and join cleanly to TRAINING_DATA. New variables are new
  columns in `sources.WEATHER_VARIABLES`.
- Anomalies and lags stay out of ENVIRONMENT (hub rule: TRAINING_DATA is
  rebuilt from source tabs). The 15 new columns are defined in DATA_DICTIONARY.

### 9.2 Processed tables (local, gitignored)

`data/processed/environment/`:
- `geography.csv`: §4.6.
- `city_weekly_dengue.csv`: `geography_id, geography_name, period_start,
  period_end, epi_year, epi_week, source_week_label, cases, status, period,
  upstream_id` (`status` ∈ reported / absent_upstream /
  suspected_reporting_gap; `cases` empty when absent).
- `city_weekly_weather.csv`: the ENVIRONMENT columns above, without
  `as_of_date`/`notes`. It replaces `city_weekly_climate.csv`.
- `weather_comparability.{json,csv}`: §4.7.
- `hub_environment.csv`: the ENVIRONMENT tab as CSV.

### 9.3 Outputs to the app

- **Implemented:** `EnvironmentalObservation` and `WeatherCoverage`
  (`web/src/types/data.ts`), served by
  `DataProvider.getEnvironmentalObservations(geographyId, {sourceId, from, to})`
  and `getWeatherCoverage()`. The data comes from
  `web/src/data/environment-weekly.json` (0.9 MB, columnar, generated by
  `environment.export`). Evidence category C, badge CONTEXT, `Provenance.method
  = "ingested"`. Sources are separate records, and every coverage record
  carries the comparability verdicts so a chart can warn before overlaying
  rainfall from two sources. The Environment map mode (Explore page) reads
  the same JSON on the client: see the 2026-10-23 update at the top.
- `CovariateAssociation` (category E, MODEL): `runId, geographyId, variable,
  lagWindow, rateRatioPerUnit, lower, upper, intervalLevel, nWeeks,
  evaluation: {logScoreGain, maeRatio, coverage, passedGate}`.
- `ClimateScenarioResult` (category E, MODEL, `illustrative: true`):
  `scenarioId, runId, geographyId, horizonWeeks, inputs: {variable, anomaly}[],
  relativeChange, lower, upper, withinObservedRange`.

## 10. Open questions for the team

1. ~~Week convention~~ **Decided 2026-10-20:** Sun–Sat MMWR (§4.2).
   Conversion lives in `ml/environment/weeks.py`. Physics 1 / Software Eng
   should use it for any new weekly source.
2. ~~Geography IDs~~ **Decided 2026-10-23:** the geography track's
   canonical ids (§4.6), checked against `data/reference/geo/` on every build.
3. **Model output typing.** `ModelOutputBase` requires a health-observation
   `Measure` (cases); a relative change is not one. Extend the type, or add a
   separate scenario type? (Software Eng)
4. ~~Open-Meteo~~ **Decided 2026-10-20:** CCHAIN primary, Open-Meteo for
   extension (§4.8). New: **should we ingest CHIRPS directly** so rainfall can
   extend past 2022 and outside CCHAIN on the same product? (Physics 3)
7. **Which LGUs outside CCHAIN?** The pipeline accepts them (§4.6), but none
   are listed yet. They need canonical ids and verified centroids. (Physics 2 /
   whole team)
5. **ACT wording.** How should "illustrative, not causal" appear to LGU users?
   (Public Admin)
6. **Track overlap.** The EARS track uses HDX DOH-Epi provinces; this track uses
   CCHAIN cities. Keep them separate, as CCHAIN advises against mixing health
   sources?
