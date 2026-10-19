# Geography track scripts

Node ≥ 20, no npm dependencies.

```bash
node scripts/geo/fetch-sources.mjs   # download HDX dengue, COD-AB, COD-PS into data/raw/ and verify SHA-256
node scripts/geo/build-geo.mjs       # rebuild every geography output (deterministic)
```

`build-geo.mjs` exits non-zero if any of these invariants fails:
- a source location is unmatched or ambiguous;
- an admin-3 unit is not covered exactly once;
- a curated city parent disagrees with COD-AB;
- an input hash has changed.

| Path | What | Edited by |
| --- | --- | --- |
| `scripts/geo/sources.json` | Upstream URLs, licences, expected hashes | Hand |
| `data/reference/geo/source_region_labels.csv` | Source region label → COD-AB region, with reason | Hand (logged decisions) |
| `data/reference/geo/name_overrides.csv` | Typos, renamed and boundary-vintage locations, with reason | Hand (logged decisions) |
| `data/reference/geo/city_classes.csv` | HUC/ICC/CC per city; verify against PSA PSGC | Hand |
| `data/reference/geo/hdx_dengue_crosswalk.csv` | **Source identifier → canonical unit mapping** | Generated |
| `data/reference/geo/geography_hub_rows.csv` | Rows for the hub GEOGRAPHY tab | Generated |
| `docs/geo/geo-data-quality-report.md` | Data-quality report | Generated |
| `web/src/data/geo/hdx-reporting-units.json` | Frontend fixture: entities, aggregation map, coverage | Generated |
| `data/processed/geo/*.csv` | Admin reference and coverage tables (not committed) | Generated |

Interpretation, supported resolutions and the spatial method:
[`docs/geo/spatial-assessment-and-method.md`](../../docs/geo/spatial-assessment-and-method.md).
