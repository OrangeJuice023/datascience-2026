# Environmental covariates and scenario analysis (Physics 3)

> **Status, 2026-10-18.** Sources verified, raw data downloaded, alignment
> analysis done, aligned city-week tables built. **No model has been fitted
> and no scenario output exists.** The input schema and output contract at the
> end of this document are a **proposal for team review**; nothing downstream
> (hub ENVIRONMENT tab, `web/`) should be built against them until agreed.
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
| Open-Meteo historical API | ERA5-based reanalysis served as point time series | Point (interpolated grid) | Hourly/daily | Data CC BY 4.0; **free tier non-commercial only**, < 10 000 calls/day | **Not recommended as primary.** Same upstream as CCHAIN's ERA5, but point values, not area/population-weighted. Fallback for non-CCHAIN areas |
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

Reproduce with `python -m environment.crosscheck` and `python -m environment.build`
(from `ml/`). Outputs land in `data/processed/environment/`.

### 4.1 Grid

- Dengue: complete Monday-week grid per city. Weeks absent upstream stay
  absent (`status = absent_upstream`). Two weeks are absent in every city:
  **2012-12-31 and 2018-01-01**, both year-boundary weeks.
- Climate: daily barangay values → population-weighted city mean (WorldPop
  2020 weights) → Monday-week. Weekly rainfall is the 7-day sum and is left
  empty unless all 7 days are present. Weeks with fewer than 7 days are dropped.

### 4.2 Week label (unresolved, about ±1 week)

CCHAIN dates are Mondays; HDX DOH-Epi dates are Sundays. Matching the 10
shared cities over 2016–2020, the best alignment is **HDX date − 13 days =
CCHAIN Monday** (mean r = 0.83; −6 days gives 0.81). Exact count matches are
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

### 4.5 Usable cities

Dagupan, Mandaue, Tacloban, Zamboanga, Cagayan de Oro, Davao, Mandaluyong,
Navotas, Muntinlupa. Fit window: 2008-01 → 2020-03-15. The 2020-03-16 →
2022 period is tagged `covid_disruption` and is reported separately, not
pooled.

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

## 9. PROPOSED input schema and output contract — needs team sign-off

### 9.1 Differences from the current hub ENVIRONMENT tab

The current tab is `date, geography_id, latitude, longitude, temperature_c,
precipitation_mm, humidity_pct, weather_source, source_url, retrieved_at,
as_of_date, feature_status, notes`. This assumes daily point weather
(Open-Meteo style). Proposed changes:

1. Replace `date` with `period_start` / `period_end` + `temporal_resolution`
   (matches DATA_DICTIONARY).
2. Replace `latitude` / `longitude` with `geographic_level` + `aggregation_method`
   (`population_weighted_mean_of_barangays`). Values are area aggregates, not points.
3. Add `upstream_product` (ERA5 / CHIRPS), `coverage_days` (0–7), `evidence_type = FORMAL_OBSERVATION`
   for raw values and `DERIVED` for anomalies/lags, `confidence`, `is_sample`.
4. Keep anomalies and lags out of ENVIRONMENT. They belong in TRAINING_DATA,
   rebuilt from source per hub rules.

### 9.2 Processed tables (already produced, local, gitignored)

`data/processed/environment/city_weekly_dengue.csv`:
`city_pcode, city_name, week_start, week_end, cases, status, period, upstream_id`
(`status` ∈ reported / absent_upstream / suspected_reporting_gap; `cases` empty when absent)

`data/processed/environment/city_weekly_climate.csv`:
`city_pcode, week_start, pr_mm, tave_c, tmin_c, tmax_c, rh_pct, min_brgy_with_pr, brgy`

### 9.3 Proposed outputs to the app (not implemented)

- `EnvironmentalCovariate` (evidence category C, badge CONTEXT): one row per
  geography × week × variable, with `Provenance` (`method: "ingested"`).
- `CovariateAssociation` (category E, MODEL): `runId, geographyId, variable,
  lagWindow, rateRatioPerUnit, lower, upper, intervalLevel, nWeeks,
  evaluation: {logScoreGain, maeRatio, coverage, passedGate}`.
- `ClimateScenarioResult` (category E, MODEL, `illustrative: true`):
  `scenarioId, runId, geographyId, horizonWeeks, inputs: {variable, anomaly}[],
  relativeChange, lower, upper, withinObservedRange`.

## 10. Open questions for the team

1. **Week convention.** SIGMA's national series uses MMWR (Sunday-start) weeks;
   CCHAIN uses Monday dates. Which one is canonical, and who owns conversion?
   (Software Eng / Physics 1)
2. **Geography IDs.** CCHAIN codes look like 2016-era 9-digit PSGC with a `PH`
   prefix (`PH112402000`). Does the geography track's canonical ID map to
   these? (Physics 2)
3. **Model output typing.** `ModelOutputBase` requires a health-observation
   `Measure` (cases); a relative change is not one. Extend the type, or add a
   separate scenario type? (Software Eng)
4. **Open-Meteo.** Do we drop it as the planned source in favour of CCHAIN for
   the 12 cities? (Whole team)
5. **ACT wording.** How should "illustrative, not causal" appear to LGU users?
   (Public Admin)
6. **Track overlap.** The EARS track uses HDX DOH-Epi provinces; this track uses
   CCHAIN cities. Keep them separate, as CCHAIN advises against mixing health
   sources?
