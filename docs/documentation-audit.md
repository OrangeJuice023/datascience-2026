# Documentation audit — 2026-10-19

Scope: upstream `OrangeJuice023/datascience-2026`, `main` at `8be0e89`
(merge of PR #2), plus the open PR heads `refs/pull/1/head` (`992c9ae`) and
`refs/pull/3/head` (`077ade4`), read without checking them out.
Documentation-only changes. No application code, configuration,
dependencies or data were modified, and nothing was committed or pushed.

## 1. Documents found before the audit

| File | State found |
| --- | --- |
| `README.md` | Useful; route list missing `/access`, `/policy`; mentions a `scripts\` folder and a frontend `.env.example` that do not exist; project path `D:\SIGMA` |
| `docs/architecture.md` | Good core content; "Model roadmap" said EARS "Not started" (contradicted `docs/dengue-pipeline.md`); cited `scripts/build_opendengue.py` and `planning/OPENDENGUE_RECONCILIATION.md`, which are not in the repo; no mention of `ml/` |
| `docs/dengue-pipeline.md` | Accurate apart from small drift: omitted the `REGION IVB-MIMAROPA` fix and the ≥ 30-case spike condition; no source provenance; swap rows not mentioned |
| `docs/access-data-model.md` | Accurate, clearly labelled design-only; unchanged |
| `docs/reports/*.pdf` | Generated QA reports; unchanged |
| `planning/SIGMA_RESEARCH.md` | Research plan; unchanged |
| `web/README.md` | create-next-app boilerplate; unchanged |
| `web/AGENTS.md`, `web/CLAUDE.md` | Coding-agent instructions for Next.js; unchanged |
| PR #1: `docs/environmental-covariates.md` | Not on `main`; read and referenced |
| PR #3: `docs/geo/*.md`, `scripts/geo/README.md`, root `AGENTS.md`, `CLAUDE.md` | Not on `main`; read and referenced |

Missing before the audit: a docs index, system flows, API, prompt, policy and
mobile documentation, a backlog, and an audit record.

## 2. Missing, outdated or conflicting references (remaining in code)

- `web/src/types/data.ts` cites `docs/supabase-schema.md`, which does not exist.
- `web/scripts/build-opendengue.mjs`, `web/src/data/opendengue-provider.ts`
  and the fixture's `meta` cite `planning/OPENDENGUE_RECONCILIATION.md`,
  `scripts/build_opendengue.py` and
  `data/processed/opendengue/ph_weekly_national_2012_2023.csv`. None are in
  the repo or the open PRs.
- `web/src/data/source-catalog.ts` lists GADM as a planned source. PR #3 rules
  GADM out on licence grounds.

These are code comments or data, so they were left untouched and logged as
[next-steps.md](next-steps.md) P0-3, P2-5 and P2-7.

## 3. Main implementation findings

1. **No Policy Copilot, AI prompt, LLM provider or API route exists** on
   `main` or in the open PRs. `/policy` is static demo content plus
   rule-based ACCESS prompts. "Ask the data" in the Lab is a client-side mock.
2. **Only one real dataset reaches the UI:** OpenDengue v1.3 national weekly,
   544 rows, 2012-12-30 → 2023-11-25, from a committed fixture. Signals,
   LGU trends, ACCESS, anomaly and simulation outputs in the app are demo data.
3. **The `ml/` EARS / DOH-threshold pipeline is implemented and QA'd but not
   connected to the app** (`getAnomalyResults()` returns `[]`).
4. **Data-correctness defect (P0-1):** the local HDX DOH file has
   suspected cases↔deaths swap rows. This audit confirmed 586 rows with
   deaths > cases in the same file (SHA-256 `4e993553f10081b4…`) that PR #3
   analysed (665 suspect rows). `ml/clean_dengue.py` drops `deaths` without
   checking, so the rows feed EARS and DOH results.
5. **Reporting-unit semantics (P0-2):** 22 of the 126 local units are
   province remainders, but `ml/` labels them only with the province name.
6. **Same national series in both tracks:** the `ml/` national workbook and
   the web fixture match on all 544 weeks.
7. **Physics 3 / CCHAIN** exists only in PR #1: download, alignment and
   city-week tables. No model fitted, no scenario output. `statsmodels` is not
   in `ml/requirements.txt`.
8. **Geography:** canonical units, PSGC codes and the crosswalk exist only in
   PR #3. On `main`, every `psgcCode` is `null`.
9. **Mobile:** a responsive web layout only (drawer navigation below 768 px).
   No PWA, native app or API for one.
10. **Deployment:** Vercel is named but not configured; no deployment
    evidence. CI exists (lint, `tsc`, build, Python compile) and has no tests.

## 4. Could not be verified

| Item | Reason |
| --- | --- |
| CI results on `main` / PRs | GitHub CLI (`gh`) not installed; no web check performed |
| PR #1 / #3 review state (open, draft, approvals) | Same; only that they are unmerged is known (their heads are not in `main`) |
| Web lint, type-check, build | Not run: `node_modules` absent and dependencies were not installed during a docs-only audit |
| `ml/` pipeline outputs and stated findings (κ, episode counts, 2019 lead times) | Pipeline not re-run; QA PDFs not re-derived |
| PR #1 and PR #3 scripts and their figures | Not run (need downloads and a manual PSA file) |
| PR #3's estimate of 120 EARS / 86 DOH changed unit-weeks | Reported by PR #3 from a Node re-implementation; not reproduced |
| Behaviour on real mobile devices | No device testing |
| The "hub" workbook (GEOGRAPHY / ENVIRONMENT / TRAINING_DATA tabs) | Referenced in PRs; not in the repository |
| Existence of an external ticket board | None referenced in the repo |
| Mermaid diagrams rendering | Syntax reviewed by hand; not rendered (no Mermaid CLI available offline) |

## 5. Files created or updated by this audit

| File | Change |
| --- | --- |
| `docs/README.md` | **Created**: index, audiences, update triggers, authority table |
| `docs/system-flow.md` | **Created** |
| `docs/api.md` | **Created** |
| `docs/prompt.md` | **Created** (documents absence; proposed requirements) |
| `docs/policy-module.md` | **Created** |
| `docs/mobile.md` | **Created** |
| `docs/next-steps.md` | **Created**: 26 items, P0–P3 |
| `docs/documentation-audit.md` | **Created** (this file) |
| `docs/architecture.md` | **Updated**: all prior content kept; added `ml/` track, Mermaid diagrams, geography, env table, open-PR section, limitations; corrected the model roadmap; marked missing referenced files |
| `docs/dengue-pipeline.md` | **Updated**: two drift fixes, explicit date format, source identity, three new known limitations |
| `README.md` | **Updated**: full route list, env note, link to the docs index |

## 6. Unresolved decisions (owners from PR hand-off tables where given)

- Policy Copilot in scope or not, and the policy evidence schema (Policy team / Public Admin, Software Eng) — P1-6.
- Swap-row rule for `ml/` (Physics 1) — P0-1.
- Geography contract: optional fields vs a `ReportingUnit` type; location of `scripts/geo/` (Software Eng) — P1-1.
- Week convention and HDX `date` meaning (Physics 1, Software Eng) — P1-2.
- How `ml/` results reach the app (fixture, database, API) — P1-3.
- Typing for non-count model outputs; Open-Meteo vs CCHAIN (Software Eng, whole team) — P1-5, P2-5.
- Supabase schema and auth — P3-3.

## 7. Commands and checks actually executed

| Command / check | Result |
| --- | --- |
| `git status`, `git branch -a -vv`, `git log`, `git ls-files` (local fork clone, branch `feat/dengue-ears-pipeline` @ `a03773a`) | Clean tree; `a03773a` content identical to upstream `main` (`git diff a03773a origin/main` empty) |
| `git ls-remote` on upstream | `main` = `8be0e89`; PR heads 1 (`992c9ae`), 2 (`a03773a`, merged), 3 (`077ade4`) |
| `git fetch origin` + PR refs (read-only refs; no checkout) | Succeeded |
| `git clone` of upstream into `C:\Users\chick\GitHub-Codes\SIGMA` | Docs written there on `main`, uncommitted |
| Searches for API routes, Server Actions, `fetch(`, LLM SDKs, env reads, CCHAIN/weather, manifest/service worker, tests, deploy config | As reported in §3 |
| `python -m compileall -q ml` (Python 3.11.9) | Exit 0 |
| Python: compare `data/raw` national xlsx with `web/src/data/opendengue-ph.json` | 544 overlapping weeks, 544 exact matches |
| `sha256sum` of local CSV; count `deaths > cases` | `4e993553f10081b4…`; 586 rows |
| `gh run list` | Failed: `gh` not installed |
| Doc check script: Markdown links and anchors, 298 backticked repo paths vs `git ls-files`, PR-only paths vs PR heads | All links and anchors resolve; every path not on `main` is described in the docs as missing, git-ignored, a directory, or PR-only, and each PR-only path exists in its PR |
| Identifier check: 50+ function/component/constant names via `git grep -w` on `main` | All found |
| Env var names (`NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_STYLE`, `NEXT_PUBLIC_MAP_STYLE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`) | Match `web/src/lib/map/basemap.ts` and `ml/.env.example` |
| Secret-pattern scan over all edited Markdown | No matches |
| `git status` after writing | Only the 11 files in §5 changed |

## 8. Cross-reference and completeness checklist

- [x] Architecture links to system flows and API contracts ([architecture.md](architecture.md) header and sections).
- [x] System flows reference actual components and functions (identifier check, §7).
- [x] Policy documentation references the real prompt and API implementation. Both are absent, which is stated with evidence in [policy-module.md](policy-module.md) §4 and [prompt.md](prompt.md) §1.
- [x] API documentation matches actual route handlers and types (no handlers; provider methods and types from `web/src/data/provider.ts`, `web/src/types/*`).
- [x] Data pipelines identify inputs, outputs and quality limitations ([dengue-pipeline.md](dengue-pipeline.md), [api.md](api.md) §3, [architecture.md](architecture.md)).
- [x] Mobile documentation distinguishes responsive web support from native mobile support ([mobile.md](mobile.md) §1–§2 vs §6).
- [x] The backlog captures the blockers found here (P0-1 to P0-4, P1-1 to P1-6).
- [x] The documentation index links to every document in `docs/` ([README.md](README.md)).
- [x] Implementation claims carry repository paths.
- [x] Planned, demo, PR-only and unverified capabilities are labelled (legend in [system-flow.md](system-flow.md); §4 above).
- [ ] Mermaid diagrams rendered in a viewer (manual syntax review only).
- [ ] Web build, lint and type-check re-run (not run in this audit).

## 9. Remaining documentation gaps

- `docs/supabase-schema.md` (referenced by code) and the OpenDengue
  reconciliation record do not exist.
- No `web/.env.example`; `web/README.md` is still boilerplate.
- When PRs #1 and #3 merge, add their docs to [README.md](README.md) and
  update the "Pending work" section of [architecture.md](architecture.md).
- No contributor/setup guide for Windows vs POSIX beyond the root README.
