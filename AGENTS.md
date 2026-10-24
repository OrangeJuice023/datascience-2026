# Instructions for AI coding agents (GPT/Codex, Kilo, Cursor, …)

These rules apply to every AI agent working in this repository.
`web/AGENTS.md` adds Next.js rules for the frontend; read it before touching `web/`.

SIGMA is a hackathon public-health project (PJDSC 2026): dengue early-warning (EARS vs DOH
thresholds) on Philippine data, with a map frontend. Several team members and several agents
work on it in parallel, so most of these rules are about staying in sync and leaving work that
a human can review quickly.

## 1. Hard rules

- **Never approve, merge or close a pull request on your own initiative.** Do not add
  reviewers, approve reviews or enable auto-merge, via `gh` or anything else. You may push
  branches and open or draft PRs.
  - **Merging on request:** you may merge a specific PR when a team member explicitly asks
    you to merge that PR, and only after its CI checks pass and it has no conflicts with
    `main`. Say which PR you merged and who asked, in your hand-off notes. A general
    "merge things" or an earlier approval does not count for a different PR.
- **Never force-push, rewrite published history, or delete branches** unless a human asks for
  that specific action.
- **Never commit data that is git-ignored or not licensed for redistribution.** `data/raw/` and
  `data/processed/` stay local. GADM is never used (non-commercial, no redistribution). The PSA
  PSGC file stays in `data/raw/psa_psgc/`.
- **Never commit secrets.** Only `.env.example` files are committed.
- **Never treat missing data as zero.** Missing weeks, absent rows and suspect rows are null /
  "no data" in every calculation, map and chart.
- **Never present output as a validated public-health claim.** This is a hackathon prototype.

## 2. Before starting any task: scope out and sync

1. **Sync to the latest commit.**
   ```bash
   git fetch --all --prune
   git status -sb            # is the branch behind its remote?
   git log --oneline -10 origin/main
   ```
   If this clone is a fork, the team repository should be a remote called `upstream`. If there
   is no `upstream` remote, ask the human for its URL; do not guess. Bring the branch up to date
   (`git pull --rebase` on your own unpushed work, or `git merge upstream/main`) **before**
   editing, and again before opening a PR.
2. **Read what changed recently.** Read the latest merged PRs and commit messages
   (`git log -10 --stat`) so you build on teammates' work instead of duplicating or
   contradicting it.
3. **Scope out the code you will touch.** Read the module's README/docs (table in §4) and the
   files themselves before changing them. Check whether a generated file is involved (§5).
4. **Respect ownership.** Each module has an owner (see `git log` for the module). Do not
   rewrite another member's module unasked. Put the issue in your PR or hand-off notes, or
   draft the change on its own branch and flag it for their review.

## 3. Branches, commits, PRs

- Work on a feature branch (`feat/…`, `fix/…`, `docs/…`) unless the human says to work on
  `main` (some members work on `main` in their own fork; that is fine there).
- Conventional commit messages: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- Stage files by name. Do not commit stray files (session logs, `*.xlsx` hub copies, PDFs,
  `node_modules/`, `tsconfig.tsbuildinfo`) unless asked.
- Before a PR, confirm that the branch is up to date with the team's `main` and contains no
  unrelated changes (`git diff --stat upstream/main...HEAD`).

### PR / ticket description template

Every PR, issue or ticket you draft uses this structure:

```markdown
## Title
<conventional-commit style, e.g. "feat: geography track for HDX dengue reporting units">

## In plain language
2–5 sentences for a non-technical teammate: what problem this solves, what changes for the
project, and what is still uncertain. No jargon, or explain it in the same sentence.

## Details
Technical description: approach, key decisions and why, data sources and licences, numbers
that back the findings, assumptions, known limitations.

## Updates
- Bullet list of behaviour or results that changed (new checks, new columns, fixed bugs,
  changed outputs). Mention any effect on other members' modules.

## Files
| File | Status | What it is |
| --- | --- | --- |
| path/to/file | created / updated / generated / filled in | one line |

## How to verify
Commands a reviewer can run, and what they should see.

## Open questions / hand-offs
Who needs to do or decide what next.
```

End PR descriptions with the attribution line your tool requires, if any.

## 4. Repository map

| Path | What | Run / check |
| --- | --- | --- |
| `web/` | Next.js + TypeScript + Tailwind frontend (MapLibre, deck.gl, Recharts). Read `web/AGENTS.md`. | `cd web && npm ci && npm run lint && npx tsc --noEmit && npm run build` |
| `ml/` | Python dengue pipeline: `clean_dengue.py` → `ears.py` → `export_sigma_web.py` (map data), QA reports in `ml/qa/` → `docs/reports/`; spatial analysis of the EARS signals in `ml/spatial/` (`python -m spatial.run && python -m spatial.report` from `ml/`). Docs: `docs/dengue-pipeline.md`, `docs/geo/spatial-assessment-and-method.md`. | `pip install -r ml/requirements.txt`, `python -m compileall -q ml`, `python -m unittest discover -s ml/tests` |
| `scripts/geo/` | Geography track (Node ≥ 20, no npm deps): HDX dengue reporting units → COD-AB / PSA PSGC. Docs: `scripts/geo/README.md`, `docs/geo/`. | `node scripts/geo/fetch-sources.mjs && node scripts/geo/build-geo.mjs && node scripts/geo/build-boundaries.mjs` |
| `data/reference/` | Small committed reference tables (crosswalks, hub rows, curated decisions). | |
| `data/sample/` | Small sample data safe to commit. | |
| `data/raw/`, `data/processed/` | Local only, git-ignored. | |
| `docs/` | Architecture, pipeline, geography and data-model docs. | |
| `planning/SIGMA_RESEARCH.md` | Research plan the analysis follows. | |
| `.github/workflows/validate.yml` | CI: web lint, typecheck, build; Python compile check. | |

Run the checks for every area you touched before you commit, and report the results honestly
(including failures) in the PR.

## 5. Generated vs hand-edited files

- **Generated; never edit by hand.** Change the inputs or the script and rebuild:
  `data/reference/geo/hdx_dengue_crosswalk.csv`, `data/reference/geo/geography_hub_rows.csv`,
  `docs/geo/geo-data-quality-report.md`, `web/src/data/geo/hdx-reporting-units.json`,
  `web/public/geo/hdx-reporting-units.geojson` (`scripts/geo/build-boundaries.mjs`),
  `web/public/data/sigma/hdx-dengue-sigma.json` (`ml/export_sigma_web.py`),
  `web/src/data/landing/pixel-map.json` (`web/scripts/build-landing-pixels.mjs`),
  `docs/reports/*.pdf`, `docs/geo/spatial-analysis-report.md` and `docs/geo/figures/spatial-*.png`
  (`ml/spatial/report.py`), and the OpenDengue fixture built by `web/scripts/build-opendengue.mjs`.
- **Hand-curated, logged decisions:** `data/reference/geo/{name_overrides,source_region_labels,city_classes}.csv`.
  Every row needs a `reason`/`basis`.
- Build scripts are deterministic and hash-check their inputs. If a hash check fails, the
  upstream file changed: report it, do not just update the hash.

## 6. Data rules for this project

- **HDX DOH dengue (2016–2021)** has 126 *reporting units*, not provinces: 59 provinces,
  22 province remainders (province minus separately reported cities), 44 cities, Pateros.
  A remainder is not the whole province. Sum only upward (unit → province → region →
  national), never split a value downward.
- **Join key** between `ml/` output (`geography_name`) and geography: the crosswalk column
  `ml_geography_name`.
- **Suspected cases↔deaths swap rows** (665 rows, Sep–Oct of 2016, 2017 and 2020) are
  missing data, never zero and never silently swapped back.
- **Missing weeks** (for example, 2019-01-06 for every unit) are null rows. Never zero-fill or
  interpolate them.
- **Regions:** aggregate by the source-period region (`analysis_region_id`), not by the prefix
  of current PSGC codes (the Negros Island Region and Sulu changed after 2021).
- **Unresolved, do not assume:** the meaning of the HDX `date` column, whether counts are by
  residence, and whether province rows truly exclude their HUCs/ICCs. State the assumption
  wherever results depend on it.
- **Sources and licences:** COD-AB and geoBoundaries (CC BY-IGO), HDX dengue (CC BY),
  OpenDengue, PSA PSGC (manual download; psa.gov.ph blocks scripts). Record every new source
  with URL, licence and hash.
- **Mark demo data** as demo in the UI and in data (`isSample`). Never invent values to fill
  a chart.

## 7. Working style

- Keep changes scoped to the task. Match the surrounding code's style, naming and comment
  density.
- Verify before claiming. If you could not run something, say so.
- Write documentation for teammates from different disciplines: plain language first, then
  the detail.
- When you find a problem in someone else's area, quantify it, write it down (PR notes or the
  module's doc), and hand it off. Don't just fix it silently.
