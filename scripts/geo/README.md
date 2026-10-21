# Geography track scripts

Node ≥ 20, no npm dependencies.

```bash
node scripts/geo/fetch-sources.mjs   # download HDX dengue, COD-AB, COD-PS, CCHAIN location.csv into data/raw/ and verify SHA-256 of all inputs
node scripts/geo/build-geo.mjs       # rebuild every geography output (deterministic)
```

Before `fetch-sources.mjs`, put the PSA PSGC file in `data/raw/psa_psgc/` by hand (see the table
below). Every other input is downloaded and hash-checked.

**Check a clean checkout.** After the two commands, `git diff --quiet && echo unchanged` should print
`unchanged`: the build reproduces the committed outputs. The outputs cite the retrieval date pinned in
`sources.json` (`pinnedRetrievedAt`), not the local fetch time. On Windows with `core.autocrlf=true`,
`git status` may still list the regenerated files because of line endings; `git diff` shows no change.
Last checked on 2026-10-21 from a fresh clone of `feat/geography-track` with only the PSA file copied in.

`build-geo.mjs` exits non-zero if any of these invariants fails:
- a source location is unmatched or ambiguous;
- an admin-3 unit is not covered exactly once;
- a unit has no PSA PSGC code, a city class disagrees with PSA, or a PSA HUC/ICC is not a reporting unit;
- a curated city parent disagrees with COD-AB;
- an input hash has changed.

| Path | What | Edited by |
| --- | --- | --- |
| `scripts/geo/sources.json` | Upstream URLs, licences, expected hashes, pinned retrieval dates | Hand |
| `data/reference/geo/source_region_labels.csv` | Source region label → COD-AB region, with reason | Hand (logged decisions) |
| `data/reference/geo/name_overrides.csv` | Typos, renamed and boundary-vintage locations, with reason | Hand (logged decisions) |
| `data/raw/psa_psgc/PSGC-3Q-2026-Publication-Datafile.xlsx` | PSA PSGC. **Manual download** from psa.gov.ph (it returns 403 to scripts); not committed | Hand |
| `data/reference/geo/city_classes.csv` | HUC/ICC/CC per city; checked against PSA PSGC on every build | Hand |
| `data/reference/geo/hdx_dengue_crosswalk.csv` | **Source identifier → canonical unit mapping** | Generated |
| `data/reference/geo/geography_hub_rows.csv` | Rows for the hub GEOGRAPHY tab | Generated |
| `data/reference/geo/cchain_city_crosswalk.csv` | Project CCHAIN city codes → COD-AB / PSA code / HDX reporting unit (environment track) | Generated |
| `docs/geo/geo-data-quality-report.md` | Data-quality report | Generated |
| `web/src/data/geo/hdx-reporting-units.json` | Frontend fixture: entities, aggregation map, coverage | Generated |
| `data/processed/geo/*.csv` | Admin reference and coverage tables (not committed) | Generated |

Interpretation, supported resolutions and the spatial method:
[`docs/geo/spatial-assessment-and-method.md`](../../docs/geo/spatial-assessment-and-method.md).
