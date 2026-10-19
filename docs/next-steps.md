# SIGMA — Next steps (prioritized backlog)

Built from the 2026-10-19 documentation audit
([documentation-audit.md](documentation-audit.md)) of `main` at `8be0e89`,
plus open PRs #1 and #3. Every item cites the evidence it came from. No
external ticket board or project tracker was found in the repository; if one
exists, link its tickets here instead of duplicating them.

**Owners** are given only where the repository names one: the hand-off tables
in PR #1 (`docs/environmental-covariates.md` §10) and PR #3
(`docs/geo/spatial-assessment-and-method.md` §6) use *Physics 1* (temporal /
EARS), *Physics 2* (geography), *Physics 3* (environment), *Software Eng*,
*Public Admin*, and *Whole team*. Elsewhere the owner is "TBD".

**Status values:** NOT STARTED · IN PROGRESS · BLOCKED · NEEDS VERIFICATION · DONE.
"IN PROGRESS" for a PR means its branch exists upstream and is not merged;
its review state could not be checked.

## Summary

| ID | Title | Status |
| --- | --- | --- |
| P0-1 | Treat suspected cases↔deaths swap rows as missing in `ml/` | NOT STARTED |
| P0-2 | Stop presenting province remainders as whole provinces | BLOCKED |
| P0-3 | Make the OpenDengue fixture reproducible from the repo | NOT STARTED |
| P0-4 | Record provenance and licence of the `ml/` raw inputs on `main` | NOT STARTED |
| P1-1 | Review and merge the geography track (PR #3) | IN PROGRESS |
| P1-2 | Decide the week convention and the HDX `date` meaning | NOT STARTED |
| P1-3 | Connect DOH-threshold and EARS outputs to the app | BLOCKED |
| P1-4 | Review and merge the environmental data preparation (PR #1) | IN PROGRESS |
| P1-5 | Fit and backtest the Physics 3 covariate model against the gate | BLOCKED |
| P1-6 | Decide Policy Copilot scope and the policy evidence model | NOT STARTED |
| P2-1 | Automated tests for EARS, DOH thresholds and data shaping | NOT STARTED |
| P2-2 | Verify CI on `main` and on open PRs | NEEDS VERIFICATION |
| P2-3 | Deployment configuration and a verified deploy | NOT STARTED |
| P2-4 | Basemap production readiness (OSM policy, MapTiler key) | NOT STARTED |
| P2-5 | Align the source catalog with the licence decisions | NOT STARTED |
| P2-6 | Davao Occidental / Davao del Sur 2016 consistency | NOT STARTED |
| P2-7 | Remove dangling document references from code and docs | NOT STARTED |
| P2-8 | Mobile validation pass on real devices | NOT STARTED |
| P2-9 | Compare calculated DOH thresholds with official DOH declarations | NOT STARTED |
| P2-10 | Scripted raw-data acquisition for the EARS pipeline | NOT STARTED |
| P3-1 | Choose and build a mobile delivery option | NOT STARTED |
| P3-2 | Event-signal ingestion pipeline | NOT STARTED |
| P3-3 | Database, authentication and real providers | NOT STARTED |
| P3-4 | Sub-national OpenDengue integration | NOT STARTED |
| P3-5 | Climate scenario tool (only if P1-5 passes) | BLOCKED |
| P3-6 | Real "Ask the data" / policy assistant (only if P1-6 approves) | BLOCKED |

---

## P0 — Data correctness, security, or blockers to trustworthy functionality

### P0-1 Treat suspected cases↔deaths swap rows as missing in `ml/`

- **Why:** The HDX DOH local file has blocks of rows (Sep–Oct 2016, 2017,
  2020) where cases and deaths appear swapped. `ml/clean_dengue.py` drops
  `deaths` in `clean_local()` without checking, so these rows enter the DOH
  thresholds and EARS as ordinary `ok` weeks. PR #3 estimates that treating
  the 665 rows as missing flips the EARS result on 120 other unit-weeks and
  the DOH status on 86, while leaving the 2019 national findings unchanged.
  That estimate comes from a Node re-implementation, not from the Python
  scripts themselves.
- **Evidence:** `ml/clean_dengue.py` (`clean_local`, `df.drop(columns="deaths")`);
  audit check on the same file (SHA-256 `4e993553f10081b4…`): 586 rows with
  deaths > cases; PR #3 `docs/geo/spatial-assessment-and-method.md` §4.3 A4
  and §6.1; `docs/geo/geo-data-quality-report.md` §2, §5.
- **Owner:** Physics 1 (rule), with Software Eng (PR #3 §6 hand-off).
- **Dependencies:** Decision to use PR #3's detection rule (a row out of date
  order in a week where ≥ 10 units have one) or another documented rule.
- **Acceptance criteria:** `clean_dengue.py` marks the rows (e.g.
  `data_quality = "suspect swap"`) before dropping `deaths`. They are excluded
  from baselines and alarms, never zero-filled or swapped back. The
  `dengue_cases_combined.xlsx` and `dengue_ears.xlsx` outputs and both QA
  PDFs are regenerated. [dengue-pipeline.md](dengue-pipeline.md) "Key
  findings" are re-checked and updated, including κ = 0.19 and the 245/409
  episodes figure. A sensitivity run with the rows swapped back is reported.
- **Status:** NOT STARTED

### P0-2 Stop presenting province remainders as whole provinces

- **Why:** 22 of the 126 local units are a province minus its separately
  reported cities. `ml/` outputs name them only by the province (e.g.
  `ILOILO`), so any table or map built from them will mislabel and
  undercount the province.
- **Evidence:** `ml/clean_dengue.py` (`geography_name`,
  `geographic_level = "local"`); PR #3 `docs/geo/geo-data-quality-report.md`
  §3.5; `docs/geo/geographic-schema-proposal.md`.
- **Owner:** Physics 2 (crosswalk), Software Eng (types/UI), Public Admin
  (label wording, PR #3 §6).
- **Dependencies:** P1-1 (crosswalk `ml_geography_name` → unit id).
- **Acceptance criteria:** Every `ml/` output row carries the canonical unit
  id. Remainders display as "Province (excl. …)". Provinces are only ever
  produced by upward aggregation over complete weeks.
- **Status:** BLOCKED (on P1-1)

### P0-3 Make the OpenDengue fixture reproducible from the repo

- **Why:** The only real dataset in the app cannot be regenerated or audited
  from this repository. `web/scripts/build-opendengue.mjs` reads
  `data/processed/opendengue/ph_weekly_national_2012_2023.csv`, which comes
  from `scripts/build_opendengue.py` and is justified by
  `planning/OPENDENGUE_RECONCILIATION.md`. None of these three are committed.
- **Evidence:** `web/scripts/build-opendengue.mjs` header and `EXPECTED`;
  `web/src/data/opendengue-ph.json` `meta.reconciliation`, `meta.file`;
  `git ls-files` (absent).
- **Owner:** TBD (the "data track" named in [architecture.md](architecture.md)).
- **Dependencies:** None.
- **Acceptance criteria:** The Python build script and the reconciliation
  document are committed (or their absence is explained in
  [architecture.md](architecture.md)). A clean clone can rebuild
  `opendengue-ph.json` byte-identically, with the SHA-256 in `meta.sha256`
  matching.
- **Status:** NOT STARTED

### P0-4 Record provenance and licence of the `ml/` raw inputs on `main`

- **Why:** [dengue-pipeline.md](dengue-pipeline.md) names the inputs only by
  local file name. The national xlsx is a SIGMA "HEALTH OBSERVATIONS" export of
  OpenDengue (its title row says so). The local CSV is HDX "DOH-Epi Dengue
  Data 2016-2021" (Cirrolytix, attributed to DOH-EB, CC BY), and its case
  definition is total reported, not confirmed. Without that, results cannot
  be cited or reproduced.
- **Evidence:** Audit check of the xlsx header and the CSV hash; PR #3
  `docs/geo/geo-data-quality-report.md` §1; PR #1 `ml/environment/sources.py`.
- **Owner:** Physics 1.
- **Dependencies:** None (can reuse PR #3's `scripts/geo/sources.json` if merged).
- **Acceptance criteria:** [dengue-pipeline.md](dengue-pipeline.md) lists URL,
  publisher, licence, retrieval date, SHA-256 and case definition for both
  inputs. The QA PDFs cite the same.
- **Status:** NOT STARTED

## P1 — Required integration and core functionality

### P1-1 Review and merge the geography track (PR #3)

- **Why:** It provides the only verified canonical geography (126 units →
  COD-AB v03 → PSA PSGC 3Q 2026, partition-tested) and the crosswalk that
  P0-2 and P1-3 need.
- **Evidence:** `refs/pull/3/head` `077ade4`: `scripts/geo/`,
  `data/reference/geo/`, `docs/geo/`, `web/src/data/geo/hdx-reporting-units.json`.
- **Owner:** Physics 2 (author); Software Eng (schema decision, PR #3 §6).
- **Dependencies:** Software Eng answers the three questions in
  `docs/geo/geographic-schema-proposal.md`. The PSA PSGC file is a manual
  download (psa.gov.ph blocks scripts) and is not redistributable.
- **Acceptance criteria:** Merged. `node scripts/geo/build-geo.mjs` succeeds
  on a clean checkout with the documented manual input. The schema choice is
  recorded in [architecture.md](architecture.md).
- **Status:** IN PROGRESS

### P1-2 Decide the week convention and the HDX `date` meaning

- **Why:** The web app and `ml/` use MMWR (Sunday-start) weeks, while CCHAIN
  uses Monday dates. The HDX `date` column aligns best 1–2 weeks off
  OpenDengue, and with CCHAIN at −13 days. Lead-time claims (EARS vs DOH) and
  climate lags depend on this.
- **Evidence:** `web/src/lib/national-observations.ts` (`epiWeek`);
  `ml/clean_dengue.py` (`add_doh_thresholds`); PR #1 §4.2 and §10 Q1;
  PR #3 A5.
- **Owner:** Physics 1 + Software Eng (PR #1 §10 Q1).
- **Dependencies:** Optionally a reply from DOH-EB or Cirrolytix.
- **Acceptance criteria:** A written decision in
  [architecture.md](architecture.md). Every pipeline states its week
  convention. Lead times in [dengue-pipeline.md](dengue-pipeline.md) carry
  the ±1–2 week caveat until resolved.
- **Status:** NOT STARTED

### P1-3 Connect DOH-threshold and EARS outputs to the app

- **Why:** The app's Anomaly mode and Lab show demo or "Model not yet fitted"
  states, while real offline results exist in `dengue_ears.xlsx`.
- **Evidence:** `web/src/data/opendengue-provider.ts` (`getAnomalyResults`
  returns `[]`); `web/src/lib/map/modes/anomaly.ts` (`availability: "demo"`);
  `ml/ears.py` output.
- **Owner:** Software Eng with Physics 1.
- **Dependencies:** P0-1, P0-2, P1-1. A transport decision (committed
  fixture built by a deterministic script like `build-opendengue.mjs`, a
  database, or an API).
- **Acceptance criteria:** National (and, after P1-1, unit-level) EARS
  results reach the UI as `AnomalyResult` with `provenance.method =
  "modeled"`, `model` and `runId` set. Weeks not computed or flagged are
  shown as such, never as 0. The "Not fitted" sidebar badge in
  `web/src/components/layout/sidebar.tsx` reflects reality.
- **Status:** BLOCKED

### P1-4 Review and merge the environmental data preparation (PR #1)

- **Why:** It is the only verified source pairing city-weekly dengue with
  climate (12 CCHAIN cities, 2008–2022).
- **Evidence:** `refs/pull/1/head` `992c9ae`: `ml/environment/*.py`,
  `docs/environmental-covariates.md`.
- **Owner:** Physics 3 (author: Kyla Pasion).
- **Dependencies:** `statsmodels` (§5.1) is not in `ml/requirements.txt`. The
  hub ENVIRONMENT schema changes in §9 need sign-off.
- **Acceptance criteria:** Merged. `python -m environment.fetch` and
  `python -m environment.build` (from `ml/`) run on a clean machine.
  `quality_report.json` matches the doc's figures (181 suspected-gap weeks,
  9 modeling cities).
- **Status:** IN PROGRESS

### P1-5 Fit and backtest the Physics 3 covariate model against the gate

- **Why:** PR #1 only prepares data. No model has been fitted, and whether
  climate adds value is unknown.
- **Evidence:** PR #1 `docs/environmental-covariates.md` status note, §5,
  §7; no model code in either PR or on `main`.
- **Owner:** Physics 3.
- **Dependencies:** P1-4, P1-2. The output typing decision (PR #1 §10 Q3).
- **Acceptance criteria:** M0/M1/M2/M2-perm fitted. Rolling-origin backtest
  (origins 2014-01 → 2020-03, horizons 1/2/4 weeks) reported per city.
  Pass/fail against every criterion in §7 recorded, **including a negative
  result**.
- **Status:** BLOCKED

### P1-6 Decide Policy Copilot scope and the policy evidence model

- **Why:** No AI assistant, prompt, API route or policy dataset exists. The
  Policy page is static demo text (see [policy-module.md](policy-module.md)).
  Any assistant needs a source of verified policy records, or it will
  generate unsupported claims about LGU policies.
- **Evidence:** `web/src/app/policy/policy-view.tsx`,
  `web/src/data/demo-policy.ts`; no `web/src/app/api/`; no LLM SDK in
  `web/package.json`.
- **Owner:** Policy team / Public Admin (content), Software Eng (build). Both
  are named in the brief; ownership is not recorded in the repo.
- **Dependencies:** None to decide. Building it depends on a policy evidence
  dataset.
- **Acceptance criteria:** A written yes/no on an LLM assistant. If yes: a
  policy record schema separating adoption, implementation,
  funding/resources, documented outcomes and implementation gaps, each with
  a source document; an approved system prompt checked into the repo;
  server-side route requirements met (see [policy-module.md](policy-module.md)
  §"Requirements before any assistant ships"). Then [prompt.md](prompt.md)
  and [api.md](api.md) are updated.
- **Status:** NOT STARTED

## P2 — Improvements and validation

### P2-1 Automated tests for EARS, DOH thresholds and data shaping

- **Why:** There are no tests in either track. `ml/qa/ears_analysis.py`
  already contains an independent re-implementation (`recompute`) that could
  become a regression test.
- **Evidence:** No test files or test config (`git ls-files`); CI runs no
  tests.
- **Owner:** TBD.
- **Dependencies:** A small committed sample in `data/sample/` (currently
  only `.gitkeep`).
- **Acceptance criteria:** pytest covers C1/C2/C3 edge cases (short
  baseline, SD floor, min count, flagged weeks), DOH fallbacks (2 of 3 years,
  week 53) and the swap rule. Web tests cover `summarizeNational`
  (gaps, epi weeks), `computeAccessMetrics` and the
  `build-opendengue.mjs` validation. All run in CI.
- **Status:** NOT STARTED

### P2-2 Verify CI on `main` and on open PRs

- **Why:** The workflow exists, but its results were not observable in this
  audit (no GitHub CLI). The ML job only compiles Python files, so it would
  not catch a broken pipeline.
- **Evidence:** `.github/workflows/validate.yml`.
- **Owner:** Software Eng.
- **Acceptance criteria:** The latest runs on `main`, PR #1 and PR #3 are
  green and linked here. The ML job runs the pipeline (or tests) on sample
  data. PR #3's Node scripts are covered.
- **Status:** NEEDS VERIFICATION

### P2-3 Deployment configuration and a verified deploy

- **Why:** README says "Vercel (not yet configured)". There is no
  `vercel.json`, no `web/.env.example` and no record of a deployment.
- **Evidence:** `README.md`; `git ls-files`.
- **Owner:** Software Eng.
- **Acceptance criteria:** `web/.env.example` lists the three
  `NEXT_PUBLIC_*` map variables with no values. A deployed URL and the
  commit it serves are recorded in [architecture.md](architecture.md). Every
  route renders on it, including the OSM fallback with no key.
- **Status:** NOT STARTED

### P2-4 Basemap production readiness

- **Why:** Without a key the app requests `tile.openstreetmap.org` directly.
  The OSM tile usage policy restricts heavy or production use. The MapTiler
  key is public by design and needs an origin restriction.
- **Evidence:** `web/src/lib/map/basemap.ts` (`OSM_RASTER_STYLE`, comment on
  origin restriction).
- **Owner:** Software Eng.
- **Acceptance criteria:** The production basemap provider is chosen. The key
  is restricted to deployment origins. The fallback is documented as dev-only
  or replaced.
- **Status:** NOT STARTED

### P2-5 Align the source catalog with the licence decisions

- **Why:** `web/src/data/source-catalog.ts` lists "GADM boundaries" (planned)
  and "Open-Meteo historical weather" (planned). PR #3 rules out GADM
  (non-commercial, no redistribution) in favour of COD-AB / geoBoundaries,
  and PR #1 recommends CCHAIN over Open-Meteo.
- **Evidence:** `web/src/data/source-catalog.ts`;
  `web/src/lib/map/modes/index.ts` (Environment mode text); PR #3 `AGENTS.md`
  §1, §6; PR #1 §2, §10 Q4.
- **Owner:** Software Eng (PR #3 §6).
- **Dependencies:** P1-1, P1-4, team decision on Open-Meteo.
- **Acceptance criteria:** The catalog and the Environment-mode text match the
  agreed sources.
- **Status:** NOT STARTED

### P2-6 Davao Occidental / Davao del Sur 2016 consistency

- **Why:** Davao Occidental has no 2016 rows, and its cases may sit inside
  Davao del Sur. Any 2016 analysis or map must merge the two or drop the
  year.
- **Evidence:** PR #3 `docs/geo/geo-data-quality-report.md` §5;
  `ml/clean_dengue.py` (`flag_year_end_artefacts` comment).
- **Owner:** Physics 1 (PR #3 §6).
- **Acceptance criteria:** A documented rule, applied in `ml/` before any
  2016 unit-level output is shown.
- **Status:** NOT STARTED

### P2-7 Remove dangling document references

- **Why:** These files are referenced but do not exist:
  `docs/supabase-schema.md` (in `web/src/types/data.ts`),
  `planning/OPENDENGUE_RECONCILIATION.md` and `scripts/build_opendengue.py`
  (in `build-opendengue.mjs`, `opendengue-provider.ts` and the fixture). The
  root `README.md` describes a `scripts\` folder and a frontend
  `.env.example` that do not exist on `main`.
- **Owner:** TBD (code comments belong to their module owners).
- **Dependencies:** P0-3 may resolve two of them.
- **Acceptance criteria:** Each reference points at a real file or is
  removed.
- **Status:** NOT STARTED

### P2-8 Mobile validation pass on real devices

- **Why:** The layout is responsive by construction, but nothing has been
  tested on phones. Maps use WebGL with no touch-specific configuration.
- **Evidence:** [mobile.md](mobile.md).
- **Owner:** TBD.
- **Acceptance criteria:** The checklist in [mobile.md](mobile.md) is
  completed on the listed devices, and defects are filed.
- **Status:** NOT STARTED

### P2-9 Compare calculated DOH thresholds with official DOH declarations

- **Why:** The pipeline's DOH threshold uses 3 prior years per unit. The
  official system uses 3–5 years and regional thresholds, and
  [dengue-pipeline.md](dengue-pipeline.md) says the calculated one "runs
  hotter".
- **Evidence:** [dengue-pipeline.md](dengue-pipeline.md) "Known limitations".
- **Owner:** Physics 1.
- **Acceptance criteria:** Calculated alert/epidemic weeks are compared with
  documented DOH declarations (with sources), and the agreement is reported.
- **Status:** NOT STARTED

### P2-10 Scripted raw-data acquisition for the EARS pipeline

- **Why:** The EARS pipeline depends on two hand-placed files with spaces in
  their names. PRs #1 and #3 already download HDX files with hash checks.
- **Evidence:** `ml/clean_dengue.py` (`NATIONAL_SRC`, `LOCAL_SRC`); PR #1
  `ml/environment/fetch.py`; PR #3 `scripts/geo/fetch-sources.mjs`.
- **Owner:** Physics 1.
- **Dependencies:** P0-4; P1-1 (to share one download location for the HDX
  file).
- **Acceptance criteria:** One command fetches and hash-verifies the inputs,
  and the pipeline reads them from there.
- **Status:** NOT STARTED

## P3 — Future enhancements

### P3-1 Choose and build a mobile delivery option

- **Why / evidence:** No PWA manifest, service worker or native app exists
  ([mobile.md](mobile.md)).
- **Dependencies:** P2-8, P2-3, P3-3 (if offline or authenticated use is
  needed).
- **Acceptance criteria:** An option is chosen from [mobile.md](mobile.md),
  with the decision recorded.
- **Status:** NOT STARTED

### P3-2 Event-signal ingestion pipeline

- **Why / evidence:** `web/src/lib/signals/pipeline.ts` is a type contract
  only. All signals are demo.
- **Acceptance criteria:** At least one source ingested end to end into
  `PublicHealthSignal` with provenance and licence recorded.
- **Status:** NOT STARTED

### P3-3 Database, authentication and real providers

- **Why / evidence:** `SupabaseDataProvider` and `SupabaseAccessProvider`
  are named but not implemented. `ml/.env.example` declares Supabase
  variables that nothing reads. `docs/access-data-model.md` is design only.
- **Dependencies:** Schema decisions in [architecture.md](architecture.md)
  "Still open".
- **Status:** NOT STARTED

### P3-4 Sub-national OpenDengue integration

- **Why / evidence:** Admin1/Admin2 rows exist upstream and are marked
  Phase 2 in [architecture.md](architecture.md).
- **Dependencies:** P1-1.
- **Status:** NOT STARTED

### P3-5 Climate scenario tool

- **Why / evidence:** PR #1 §6 specifies it only if the §7 gate passes. The
  Simulate page stays a demo until then.
- **Dependencies:** P1-5 passing.
- **Status:** BLOCKED

### P3-6 Real "Ask the data" / policy assistant

- **Why / evidence:** `web/src/components/lab/ask-data-panel.tsx` is a static
  mock with a canned SQL string.
- **Dependencies:** P1-6 approval, P3-3, a prompt and evaluation set in
  [prompt.md](prompt.md).
- **Status:** BLOCKED
