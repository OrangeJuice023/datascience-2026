# Geography track — documentation index

Owner: Physics 2 (spatial analysis & geographic modeling). Last updated 2026-10-21.

**In plain language.** The HDX dengue file reports cases for 126 *reporting units*. Some are whole
provinces, some are a province minus its separately reported cities, some are cities, and one is
Pateros. This folder explains what those units are, how they map to official boundaries and PSA
codes, which map levels the data can support, and which data problems affect maps and early-warning
results. Everything here is a hackathon prototype, not a validated public-health product.

## Documents

| Document | Audience | Covers | Update when |
| --- | --- | --- | --- |
| [spatial-assessment-and-method.md](spatial-assessment-and-method.md) | Everyone; Physics 1/2 in depth | What the units are, supported levels, prohibited operations, sources and licences, assumptions A1–A5, spatial method, hand-offs, status against the EARS pipeline | An assumption is confirmed or refuted, or the cleaning pipeline changes |
| [geo-data-quality-report.md](geo-data-quality-report.md) | Reviewers, Physics 1/2 | **Generated.** Every number: inputs and hashes, matching, partition test, coverage, missing weeks, swap rows | Never by hand; rerun `build-geo.mjs` |
| [geographic-schema-proposal.md](geographic-schema-proposal.md) | Software Eng | Proposed `GeographicEntity` additions (`kind`, `partialOf`, `excludes`, `analysisRegionId`, `codAbPcodes`) and display rules | Software Eng decides the contract |
| [../../scripts/geo/README.md](../../scripts/geo/README.md) | Anyone rebuilding | Commands, manual PSA input, clean-checkout check, invariants, file table | A script, input or output changes |

Authoritative sources: **the crosswalk** (`data/reference/geo/hdx_dengue_crosswalk.csv`) for
source location → canonical unit; **the method document** for rules and assumptions; **the
generated report** for numbers. Repository-wide architecture, APIs and the team backlog live in
the documentation pack (`docs/README.md`, `docs/architecture.md`, `docs/next-steps.md`, branch
`docs/documentation-pack` until merged).

## Status of geography work

| Item | Status | Evidence |
| --- | --- | --- |
| Canonical geography for the 126 units (COD-AB v03, PSA PSGC 3Q 2026) | Implemented, on `feat/geography-track` (not on `main`) | `scripts/geo/build-geo.mjs`; report §3 |
| Partition test: 1,642 / 1,642 admin-3 units covered exactly once | Implemented; build fails otherwise | Build output `partition of 1642 admin-3 OK` |
| Reproducible build from a clean checkout | **Verified 2026-10-21**: fresh clone + PSA file → `fetch-sources.mjs` → `build-geo.mjs` → `git diff` empty | `scripts/geo/README.md` |
| Join key to `ml/` output | Implemented: `ml_geography_name`, 126 / 126 match | Crosswalk; method §6.1 |
| Upward aggregation map (unit → province → region → national) | Implemented in the fixture (`aggregation.province/region/national`) | `web/src/data/geo/hdx-reporting-units.json` |
| Fixture used by the app | **Not connected.** No app code imports it | `grep -r hdx-reporting-units web/src` finds nothing |
| Geography contract in `web/src/types/data.ts` | Proposed only; every `psgcCode` on `main` is `null` | Schema proposal; `web/src/data/sample/geographies.ts` |
| Swap-row handling in `ml/clean_dengue.py` | **Not started**, tracked separately (backlog P0-1) | Method §6.1 |
| Polygons for the map | Planned. geoBoundaries gbOpen (CC BY 3.0 IGO) recommended; not downloaded | Method §3 |
| Population denominators / incidence | Not possible with current sources | Method §2 |

The fixture contains 1 national, 17 regional, 81 provincial and 45 city/municipal admin entities,
plus 22 `reporting_unit` entities for the province remainders.

## Rules that every consumer must follow

- Sum only upward: unit → province → region → national. Never split a value downward.
- A province remainder is not a province. Label it "Iloilo (excl. Iloilo City)", never "Iloilo".
- Aggregate regions by `analysisRegionId` (source-period region), not by PSGC code prefix.
- Missing weeks and the 665 suspected swap rows are **missing**, never zero.
- Aggregates are valid only for weeks where every member unit has a usable row.
- No barangay data, no incidence rates, no interpolation to hidden municipalities.

## Known issues and corrections for the documentation pack

These affect statements in `docs/documentation-pack`; the owner of that branch should decide
whether to adopt them.

1. **Swap-row count (586 vs 665).** The audit counts 586 rows with deaths > cases. 581 of these
   are among our 665 swap rows; 5 are isolated rows elsewhere (Batanes 2017-11-19, Quirino
   2017-10-15, Davao del Sur 2018-05-13, Pateros 2018-05-20, Aurora 2019-09-15). A deaths > cases
   rule misses 84 swap rows, so P0-1 should use the swap-block rule
   (report §5.1).
2. **Affected results.** Until P0-1 is fixed, do not rely on local EARS results for 2016, 2017,
   2020 and January 2021, or on any local DOH-threshold result (these start in 2019, and their
   3-year baselines include 2016, 2017 or 2020). National results are unaffected.
3. **P1-1 acceptance "succeeds on a clean checkout"** is now met (see status table). The PR
   reference "PR #3 / `077ade4`" is superseded by branch `feat/geography-track`.
4. **Three geography ID schemes** (integration audit): demo slugs on `main`, this track's unit ids
   (e.g. `iloilo-remainder`), and `psgc:<9 digits>` in `ml/geography/` on `feature/sigi-mascot`,
   which uses an unofficial 2017 PSGC mirror. **Team decision needed.** Recommendation: keep this
   track's ids as the canonical key and carry PSA codes as attributes, because a province
   remainder has no PSGC code of its own.

## Proposed geography items for the backlog

Numbered `GEO-*` so they can be merged into `docs/next-steps.md` without clashing. Items already in
the backlog are referenced, not repeated.

| ID | Title | Priority | Depends on | Acceptance criteria | Status |
| --- | --- | --- | --- | --- | --- |
| P0-1 | Swap rows missing in `ml/` | P0 | — | See backlog; use the swap-block rule, not deaths > cases | NOT STARTED |
| P0-2 | Remainders not shown as whole provinces | P0 | P1-1 | See backlog | BLOCKED |
| P1-1 | Merge the geography track | P1 | Review | Clean-checkout build verified | IN PROGRESS |
| GEO-1 | Choose one geography id scheme | P1 | Software Eng | Decision recorded in `docs/architecture.md`; other modules map to it | NOT STARTED |
| GEO-2 | Join EARS / DOH outputs to reporting units for the map | P1 | P0-1, P1-1, P1-3 | Every local result row carries a unit id; regional sums use complete weeks only; suspect and missing weeks shown as "no data" | NOT STARTED |
| GEO-3 | Simplified unit polygons for the map | P2 | P1-1 | geoBoundaries ADM2/ADM3 dissolved to the 126 units, licence and hash recorded, size suitable for the browser | NOT STARTED |
| P2-5 | Remove GADM from the source catalog | P2 | — | See backlog (`source-catalog.ts`, `sample/reference.ts`, `lib/api/sources.ts`) | NOT STARTED |
| P2-6 | Davao del Sur + Occidental 2016 | P2 | — | See backlog | NOT STARTED |
| GEO-4 | Confirm assumptions A1, A2, A5 with DOH-EB or Cirrolytix | P2 | Whole team | Answers recorded in method §4 | BLOCKED (external) |

## Geography cross-reference checklist

- [x] Crosswalk, report and fixture are generated by one script and rebuild unchanged.
- [x] Every source has URL, licence and SHA-256 (`scripts/geo/sources.json`).
- [x] Method document links to the report for every number.
- [x] Join key to `ml/` output is documented and tested (126 / 126).
- [ ] App code uses the fixture (GEO-2).
- [ ] `ml/` output carries unit ids instead of province names (P0-2).
- [ ] One geography id scheme across modules (GEO-1).
- [ ] GADM removed from catalogues (P2-5).
