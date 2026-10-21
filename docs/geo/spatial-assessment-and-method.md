# Spatial assessment and proposed method — HDX DOH-Epi dengue 2016–2021

Owner: Physics 2 (spatial analysis & geographic modeling). Status: proposal for team review, 2026-10-17.

Evidence for every number here is in the generated
[geo-data-quality-report.md](geo-data-quality-report.md). The mapping itself is in
`data/reference/geo/hdx_dengue_crosswalk.csv`. The schema is coordinated with the Software Eng
member through [geographic-schema-proposal.md](geographic-schema-proposal.md).

## 1. What the source locations actually are

The `loc` column is tagged `#adm2+name`, but it is **not** an admin-2 field. It lists **126 DOH
reporting units**:

| Unit type | Count | Example | Covers |
| --- | --- | --- | --- |
| Province, whole | 59 | Abra | The full province |
| Province remainder | 22 | Iloilo | The province **minus** the cities it contains that are reported on their own rows |
| Highly urbanized city (HUC) | 33 | Iloilo City | One city |
| Independent component city (ICC) | 5 | Naga City | One city |
| Component city (CC) | 6 | Bislig City (5 of the 6 are in Caraga) | One city |
| Municipality | 1 | Pateros | One municipality |

- **They partition the country.** Checked against COD-AB v03, the 126 units are mutually
  exclusive and together cover all 1,642 admin-3 units.
- **Province rows exclude their separately reported cities.** This is not stated by the source.
  It is supported by two checks against the independent OpenDengue national series:
  - Read as separate units, the HDX total runs 1.02–1.15× the national series.
  - Read with cities double-counted, it runs 0.76–0.88×.
  - This is **supported, not proven**, and should be confirmed with DOH-EB.

## 2. Which levels the data supports

| Level | Supported? | How | Conditions |
| --- | --- | --- | --- |
| **National** | Yes | Sum of all 126 units | Only in weeks where all 126 units have a usable row (197 of 262). Compare with OpenDengue; never merge with it. |
| **Regional (17)** | Yes | Sum of member units (`aggregation.region`) | Same week-completeness rule, applied per region. Use the **source-period region** (`analysis_region_id`), not COD-AB v03. For example, Cotabato City stays in Region XII. The Negros Island Region years are not represented. |
| **Provincial (81 full provinces)** | Yes | Province remainder + its cities (`aggregation.province`) | Valid only under the exclusivity assumption above. Maguindanao and North Cotabato are 2016–2021 vintage units, not COD-AB v03 admin-2 units. Davao del Sur and Davao Occidental must be merged for any analysis that includes 2016. |
| **Native reporting unit (126)** | Yes, this is the finest level | As published | This is the level for EARS and the DOH thresholds. A province remainder is **not** a province and must be labelled as such. |
| **City / municipal** | **Only for the 45 units reported separately** (44 cities + Pateros) | As published | No data exists for the other ~1,590 cities and municipalities. They are inside province remainders and **cannot be estimated**. |
| **Barangay** | **No** | — | No barangay data exists in the source. |
| **Incidence / risk per population** | **No** | — | COD-PS has no city rows, uses older P-codes, has a single NCR row, and only covers 2022–2025. There is no valid denominator for any reporting unit. |

**Prohibited operations.** None of these has valid supporting data:
- Splitting a national, regional, province or province-remainder count into smaller areas by area,
  population share or anything else.
- Interpolating cases to a grid, to barangays or to the hidden municipalities (kriging, IDW, dasymetric).
- Filling missing weeks or the swap-row weeks with zeros.

## 3. Boundary and reference data: suitability and licence

| Source | Levels | Licence (checked 2026-10-17) | Use in SIGMA |
| --- | --- | --- | --- |
| **OCHA COD-AB PHL v03** (NAMRIA/PSA, via HDX) | Admin 0–4 (17 / 88 / 1,642 / 11,920+) | **CC BY-IGO**: redistribution allowed with attribution | **Canonical reference** for P-codes, names, areas and centres. The geometry (shapefile/GeoJSON) is 0.9–1 GB, so it should be simplified before use in the frontend. |
| **geoBoundaries gbOpen PHL** (derived from COD-AB) | ADM1–3, simplified GeoJSON | **CC BY 3.0 IGO** (ADM2 verified via API) | **Recommended geometry** for frontend polygons and adjacency: pre-simplified and openly licensed. ADM2 has 87 units. The boundary year is 2020, which predates the Maguindanao split. |
| **GADM 4.1** | Admin 0–3 | **Non-commercial only; redistribution not allowed without permission** | **Do not use.** We cannot commit or serve it. `source-catalog.ts` lists it as planned; it should be replaced by COD-AB / geoBoundaries. `planning/SIGMA_RESEARCH.md` also says GADM only has province level for the Philippines, which is wrong; it goes down to admin 3. |
| **PSA PSGC** | Region → barangay codes and city classes | Official government publication | The authoritative code list. psa.gov.ph returns **HTTP 403 to scripts**, so the quarterly file is downloaded by hand into `data/raw/psa_psgc/` (3Q 2026 in use, hash-pinned). All 126 units resolve to a PSA code and every city class agrees; see report §3.2a. Current codes follow today's regions, so aggregation uses `analysisRegionId`, not the code prefix. |
| **COD-PS PHL** (UNFPA/PSA) | Admin 0–2 population, 2022–2025 | CC BY-IGO | **Not usable as a denominator here** (see §2). It needs an old→v03 P-code crosswalk and city-level rows. PSA 2015 POPCEN / 2020 CPH city tables would be the right source. |
| **OpenStreetMap** | Basemap (already connected) | ODbL | Basemap only. No analytical joins. |

Attribution required when publishing maps:
- **COD-AB:** "© OCHA / NAMRIA / PSA, CC BY-IGO".
- **geoBoundaries:** cite Runfola et al. 2020.
- **Dengue:** "Cirrolytix / DOH-EB via HDX, CC BY".

## 4. Proposed spatial method

The proposal asks whether EARS warns earlier than DOH thresholds, and whether local signals appear
before the national aggregate. The spatial component should answer three questions:

1. **Where and when** do EARS signals occur?
2. Are those signals **spatially clustered** beyond chance?
3. Do local signals **lead** the regional and national aggregates?

The design has to work without population denominators.

### 4.1 Unit of analysis and the key design choice

- **Detection runs on the 126 native reporting units.** Aggregates (81 provinces, 17 regions,
  national) are recomputed from them for the hierarchical comparison.
- **Spatial statistics use scale-free quantities, never raw counts.** Raw counts mostly reflect
  population size: NCR cities and Cebu will always look like hot spots. The EARS statistics avoid
  this because each unit is standardised against its own recent baseline:
  - C1 and C2 are z-scores of a unit against its own baseline;
  - C3 is a cumulative excess.
- These quantities are comparable across units without a denominator. The DOH threshold indicator
  (above alert / above epidemic) is also unit-relative.

### 4.2 Steps

1. **Panel.** Build a unit × week panel from the crosswalk. Treat missing weeks, the nationwide gap
   at 2019-01-06, and the 665 suspected swap rows as **missing**. Fix in advance how EARS windows
   handle missing baseline weeks: require at least 5 of 7 usable baseline weeks, otherwise output
   no signal.
2. **Signals.** Physics 1 / EARS workstream computes per unit and week: C1, C2, C3, alert flags,
   DOH alert/epidemic exceedance, and alert episodes.
3. **Spatial weights.** Build three neighbour definitions, each reproducible from committed data:
   - **W1, k-nearest neighbours** (k = 5) on the representative points in the crosswalk. Islands
     always get neighbours.
   - **W2, distance band.** Neighbours within d km, with d the smallest distance that leaves no
     unit isolated.
   - **W3, contiguity** from geoBoundaries ADM3 polygons dissolved to reporting units.
     - A city is always adjacent to the province remainder that encloses it.
     - Islands are linked to their nearest neighbour.
   - W1 is the primary definition; W2 and W3 are sensitivity checks.
4. **Global clustering of signals, by week.** Compute Moran's I of C2 across units, with 999-permutation p-values.
   - Report it as a time series, highlighting the 2019 epidemic season.
   - Use Benjamini–Hochberg over weeks to control false discovery.
5. **Local clusters.** Compute local Moran / Getis–Ord Gi* on C2 in each week, with conditional permutation and FDR.
   - The output is a categorical flag per unit and week: "high-signal cluster", "isolated high signal" or "not significant".
   - It is never a risk score.
6. **Space-time clustering of alert episodes.** Use the Knox test on episode start weeks.
   - Define closeness by thresholds fixed in advance: neighbours under W1, and episode starts within 2 weeks of each other.
   - Run a Monte-Carlo permutation of start times across units, 999 runs.
   - This tests whether alerts tend to start near each other in space and time, which is a spreading pattern.
7. **Local versus aggregate lead time.** For each regional or national threshold exceedance,
   measure the lead time of the first unit-level EARS episode inside that aggregate. Compare it with
   the lead time of EARS run on the aggregate series itself. This directly answers the proposal's
   question about national aggregation hiding local signals.

### 4.3 Assumptions (to be recorded before final testing)

| ID | Assumption | Status | If wrong |
| --- | --- | --- | --- |
| A1 | Province rows exclude their separately reported cities | Supported by the total-ratio and partition checks; not confirmed | Provincial aggregates double-count. Detection on native units is unaffected. |
| A2 | Cases are counted by place of residence, not place of reporting facility | **Unknown**: not stated by the source | HUCs with referral hospitals (e.g. Iloilo City, Cebu City) may be inflated relative to their province remainder, which creates false city–province contrasts. |
| A3 | 2016–2021 unit boundaries are as in COD-AB v03, adjusted for Maguindanao and the SGA | Unverified for the SGA barangays | Small: about 63 barangays move between the North Cotabato and Maguindanao units. |
| A4 | Rows in the swap blocks have swapped values | Strongly supported for 2016–2017 (r = 0.92 with neighbouring weeks); mixed for 2020 | If treated as missing (the proposal), only usable data is lost. Swapping back without a decision is not allowed. |
| A5 | Week semantics are the same across units | The HDX `date` aligns best with OpenDengue shifted 1–2 weeks earlier, so the meaning of `date` is unresolved | Lead times may be off by 1–2 weeks. This does not change the spatial structure within a week. |
| A6 | The case definition (suspect + probable + confirmed) is consistent across units and years | Assumed; passive surveillance | Reporting-intensity differences become spatial artefacts. Mitigated by using unit-standardised statistics. |

### 4.4 Validation

- **Permutation nulls** for every spatial statistic. P-values are reported with FDR control and are
  never shown as risk.
- **Weights sensitivity.** Conclusions must hold under W1, W2 and W3. Report every case where they
  do not.
- **Modifiable areal unit problem (MAUP).** Repeat the clustering tests at full-province level,
  where each province plus its cities forms one unit (81 units). This checks whether the result
  depends on the mixed city/province units.
- **Data-quality sensitivity.** Run each analysis three ways:
  - (a) swap rows missing (primary);
  - (b) swap rows swapped back;
  - (c) 2016 excluded, since 51 of its weeks are incomplete because Davao Occidental has no rows.
- **Negative control.** Shuffle unit locations, keeping each unit's series intact. Clustering should
  disappear. If it does not, the result is an artefact of the time structure.
- **Out-of-time check.** Settle the weights, thresholds and k on 2016–2018, then report 2019–2020 untouched.
- **External plausibility.** Check whether the 2019 national epidemic declaration (2019-08-06) and the
  regional outbreak declarations reported in the news fall inside detected clusters. This is
  qualitative only: there are no outbreak labels.

### 4.5 Limitations

- **No denominators.** Counts cannot be presented as incidence or risk. Unit sizes range from Pateros
  (1.6 km²) to Palawan's remainder (12,226 km²).
- **Mixed and irregular units.** Province remainders are irregular shapes with "holes" where the cities
  are. Distances between representative points are approximations.
- **Coarse resolution.** About 1,590 cities and municipalities are hidden inside province remainders.
  Local clusters below unit size cannot be seen.
- **Passive surveillance.** Reporting behaviour (delays, the 2020 COVID-era drop, regional reporting
  practice) is mixed in with dengue dynamics. Swap blocks hit whole regions in the same weeks, so data
  errors are themselves spatially structured.
- **Retrospective only.** No outbreak labels and no real-time updates exist. Results show agreement
  with DOH thresholds, not detection of confirmed outbreaks.

## 5. How results may be shown on the map

The map today draws **points**, not polygons. That fits this data.

- **Marker position.** Each reporting unit is drawn at its representative point (`centroid` in the
  fixture). This is always inside the unit. It is not the location of the cases.
- **Allowed encodings:**
  - categorical colour for the signal state: EARS flag, DOH alert/epidemic, cluster class;
  - marker size for the reported count, labelled "reported cases (not population-adjusted)";
  - a coverage badge when the week is missing or suspect.
- **Choropleth: not for counts.** If polygons are added later, choropleth fills are allowed **only**
  for categorical signal states, and the legend must read: *"Signal status relative to each area's
  own history — not a measure of local risk or incidence."*
- **Province remainders** must be labelled "Province (excl. …)". Their polygon, if drawn, must show
  the cities as holes.
- **Missing or suspect weeks** are drawn as hatched or "no data", never as zero or as the lowest class.

## 6. Hand-offs

| To | Item |
| --- | --- |
| Software Eng | Review the [schema proposal](geographic-schema-proposal.md) (`kind`, `partialOf`, `excludes`, `analysisRegionId`, `codAbPcodes`). Add swap-row and missing-week handling to the ingestion and cleaning procedure. Replace `gadm` in `source-catalog.ts` with `cod-ab-phl` and `geoboundaries`. Load `data/reference/geo/geography_hub_rows.csv` into the hub GEOGRAPHY tab. |
| Physics 1 (temporal / EARS) | The date-semantics question (A5). The rule that suspect swap rows are missing (A4). The EARS baseline rule for missing weeks. The Davao del Sur + Davao Occidental merge for 2016. |
| Whole team | ~~Download the PSA PSGC file~~ (done 2026-10-19, 3Q 2026). Ask DOH-EB or Cirrolytix whether province rows exclude HUCs/ICCs (A1) and whether counts are by residence (A2). |
| Public Administration | The display rules in §5 and the wording of the map caveat. |

### 6.1 Status against the merged EARS pipeline (PR #2, 2026-10-18)

PR #2 (`ml/clean_dengue.py`, `ml/ears.py`, [docs/dengue-pipeline.md](../dengue-pipeline.md)) uses the same 126 units and the same HDX file.

| Item | PR #2 | Status |
| --- | --- | --- |
| Missing weeks (2019-01-06; Davao Occidental 2016) | Complete weekly grid, null rows, never zero-filled | Agrees |
| Name typos (Basilig, Viscaya, Sisquijor) | Fixed in `LOC_FIXES` | Agrees. Join `geography_name` to the new crosswalk column `ml_geography_name`; all 126 match. |
| Province rows exclude cities (A1) | National ≈ 0.93 × sum of local | Agrees with the 1.02–1.15× ratio here; still unproven |
| Swap rows (A4) | Not handled; `deaths` is dropped, so the swap cannot be seen | **Open; tracked as a separate fix to `clean_dengue.py`** (agreed in review of the geography PR, 2026-10-21). 611 of the 665 rows hold 0 cases and are kept as `ok`. Only 13 get a `data_flag` (the blocks alternate weeks, so the 4-zero-week rule rarely fires). |
| Date semantics (A5) | `date` taken as the week start | Open. National lead times use OpenDengue and are not affected; local timing may shift by 1–2 weeks. |
| Davao del Sur + Occidental merge | Davao Occidental 2016 is null | Acceptable; merge still needed for any 2016 map |

**Effect of the swap rows on PR #2 results.** This is a Node re-implementation of the local half of the two scripts, not their actual output. Treating the 665 rows as missing:
- flips the EARS alarm / no-alarm result on 120 other unit-weeks (2016: 30, 2017: 35, 2020: 52, 2021: 3);
- changes the DOH status of 86 other unit-weeks, through the 2016–2017 baseline years.

The 2019 national findings are not affected. Proposed fix for `clean_dengue.py`: mark the rows as `data_quality = "suspect swap"` before `deaths` is dropped. Use the rule in `scripts/geo/build-geo.mjs`: a row out of date order in a week where at least 10 units have one.

**Until that fix lands, do not rely on local (reporting-unit) EARS results for 2016, 2017, 2020 and
January 2021, or on any local DOH-threshold result** (these start in 2019, and their 3-year
baselines include 2016, 2017 or 2020; report §5.1). National results are not affected.

**Why not "deaths > cases"?** The documentation audit on `docs/documentation-pack` counts 586 rows
with deaths > cases. 581 of them are swap rows; the other 5 are isolated rows outside the blocks.
That rule would miss 84 of the 665 swap rows (those with deaths ≤ cases), so the fix should use the
swap-block rule above.
