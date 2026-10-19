# Dengue data pipeline: cleaning, DOH thresholds and EARS

This is the first working analysis layer of SIGMA. It implements the Layer 1
statistical baseline from [planning/SIGMA_RESEARCH.md](../planning/SIGMA_RESEARCH.md)
(§9C: EARS anomaly detection; §9E: alert-time validation) on Philippine dengue
data at national and province/city level.

## Pipeline

```
data/raw/                                    (not committed, see "Data" below)
  Database for Dengue Cases at the National Level.xlsx   OpenDengue V1.3, weekly
  Database for Dengue Cases at the Local Level.csv       DOH, 126 provinces/cities
        │
        ▼  python ml/clean_dengue.py
data/processed/dengue_cases_combined.xlsx    NATIONAL + LOCAL sheets
        │                                    → QA: python ml/qa/dengue_qa_report.py
        ▼  python ml/ears.py                   → docs/reports/dengue_qa_report.pdf
data/processed/dengue_ears.xlsx              NATIONAL + LOCAL + METHOD sheets
                                             → QA: python ml/qa/ears_qa_report.py
                                               → docs/reports/dengue_ears_qa_report.pdf
```

Install dependencies with `pip install -r ml/requirements.txt`. All scripts run
from any working directory.

## Step 1: cleaning (`ml/clean_dengue.py`)

| Decision | Detail |
|---|---|
| Common range | 10/01/2016 – 03/01/2021, DD/MM/YYYY, i.e. 2016-01-10 to 2021-01-03 (261 weeks). This is the local data's span minus its last week, which was extracted before most reports arrived. |
| Complete calendar | Every series has every week. Missing weeks are **null rows**: never deleted, zero-filled or interpolated, because EARS baselines must cover consecutive weeks. |
| Columns kept | National: `geographic_level`, `period_start`, `value`. Local: everything except `deaths`. |
| Name fixes | BASILIG CITY → BISLIG CITY, NUEVA VISCAYA → NUEVA VIZCAYA, SISQUIJOR → SIQUIJOR; REGION VII-EASTERN VISAYAS → REGION VIII-EASTERN VISAYAS; REGION IVB-MIMAROPA → REGION IV-B-MIMAROPA; casing and whitespace normalised. |
| `data_quality` | `ok` / `missing` everywhere. National also has `incomplete` (fade-out before each year-end reporting cut-off) and `backlog` (early-January catch-up). Only `ok` weeks are used in calculations. |
| `data_flag` (local) | `possible non-reporting`: 4+ consecutive zero weeks where the place normally reports 10+. `one-week spike`: over 8× the 9-week median, at least 30 cases, and at least 4× both neighbouring weeks. Values are kept as published; the true counts are not recoverable from the data. |

### DOH alert and epidemic thresholds

A(w, y) = mean of Y(w, y−j) for j = 1..3 (same epi week, 3 previous years);
E(w, y) = A + 2·SD (sample SD). The current year is excluded deliberately: with
it inside the baseline, a week can be at most 1.155 SD above the mean, so the
2-SD epidemic threshold could never be crossed. Fallbacks, each explained in
`doh_note`: 2 of 3 baseline years if one is unusable; week 53 uses week 52.
Thresholds start in 2019 (first year with 3 prior years).

## Step 2: EARS (`ml/ears.py`)

| Method | Baseline | Alarm |
|---|---|---|
| C1 | weeks t−7 … t−1 | (Y − mean) / SD > 3 |
| C2 | weeks t−9 … t−3 | (Y − mean) / SD > 3 |
| C3 | C2 at t, t−1, t−2 | Σ max(0, C2 − 1) > 2 |

Settings: a baseline needs 5 of 7 usable weeks; flagged weeks get their own
result but are left out of other weeks' baselines
(`EXCLUDE_FLAGGED_FROM_BASELINE`); SD floored at 1; at least 5 cases to alarm.
`ears_alarm` reports C1, C2, C3, C1+C2, C1+C3, C2+C3, C1+C2+C3, none or not
computed; `ears_note` explains the calculation and `flag_note` carries the data
flags.

## Key findings

- **2019 epidemic:** first national EARS alarm on 26/05/2019, 7 weeks before
  DOH's national alert (15/07/2019) and 10 weeks before the national epidemic
  declaration (06/08/2019). All 17 regions alarmed before 15/07.
- **EARS gives timing, DOH thresholds give size.** EARS alarms at every season
  onset (mid-May to early June each year), so it does not single out 2019 on its
  own. Combined with the DOH threshold it does: all 13 national 2019 alarms came
  in DOH-epidemic weeks, none of the 14 in 2020.
- Week-by-week agreement with the DOH threshold is low (κ = 0.19 local) because
  the two answer different questions, but EARS fired at or before the onset of
  245 of 409 local DOH epidemic episodes.

Full detail, checks and news sources: [dengue_qa_report.pdf](reports/dengue_qa_report.pdf)
and [dengue_ears_qa_report.pdf](reports/dengue_ears_qa_report.pdf).

## Data

`data/raw/` and `data/processed/` are git-ignored by design. To reproduce, place
the two raw files above in `data/raw/` and run the pipeline.

Source identity (added by the 2026-10-19 documentation audit; full
provenance is backlog item P0-4 in [next-steps.md](next-steps.md)):

- **National:** a SIGMA "HEALTH OBSERVATIONS" export of OpenDengue v1.3
  (title row of the workbook). Its 544 weekly values match
  `web/src/data/opendengue-ph.json` exactly.
- **Local:** HDX "Philippine Dengue Cases and Deaths", file
  `DOH-Epi Dengue Data 2016-2021.csv`, published by Cirrolytix from DOH-EB
  data, CC BY. SHA-256 begins `4e993553f10081b4`. Counts are total reported
  cases (suspect + probable + confirmed), not confirmed only. The 126
  locations are DOH reporting units, 22 of them province remainders, not
  whole provinces (see the geography track in open PR #3).

## Known limitations

- Zeros cannot be distinguished from "no report" in the local source; reporting
  disruptions (Marawi siege 2017, COVID-19 lockdowns 2020) appear as zero runs.
- National OpenDengue data has year-end reporting artefacts every year.
- The calculated DOH threshold runs hotter than the official system, which uses
  3–5 years and regional thresholds.
- **Suspected cases↔deaths swap rows are not handled.** The local file has
  586 rows with deaths > cases, part of 665 suspect rows in Sep–Oct 2016,
  2017 and 2020 (identified by the geography track, open PR #3).
  `clean_local()` drops `deaths` before any check, so these rows are used as
  ordinary `ok` weeks. PR #3 estimates that treating them as missing changes
  the EARS result on 120 and the DOH status on 86 other unit-weeks, and does
  not affect the 2019 national findings. Local results for those periods
  should not be relied on until this is fixed
  ([next-steps.md](next-steps.md) P0-1).
- The meaning of the local `date` column (report vs onset week) is
  undocumented; local lead times may be off by 1–2 weeks (P1-2).
- Province-remainder units are labelled with the province name only (P0-2).
