# Spatial assessment and proposed method — HDX DOH-Epi dengue 2016–2021

Owner: Physics 2 (spatial analysis & geographic modeling). Status: proposal for team review, 2026-10-17.
**Implemented 2026-10-24** in `ml/spatial/` (steps 3–7 and the §4.4 validation); choices made in
implementation are in §4.6, results in the generated
[spatial-analysis-report.md](spatial-analysis-report.md), and what they mean in §6.2.

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

### 4.6 Implementation choices (fixed before the results were computed, 2026-10-24)

The steps above left some details open. These were fixed in `ml/spatial/run.py` before any
result was looked at. Week coverage was checked first, because it is a data property, not a
result.

- **Which weeks.** A week is analysed only when at least 80% of units have C2. Coverage is either
  full (116–126 units) or 78–83 units in the swap-row weeks of Sep–Dec 2016, 2017 and 2020, where
  the missing units are whole regions. Those weeks are skipped in the primary run and covered by
  the "swapped back" check.
- **Missing neighbours.** A neighbour without C2 that week is dropped, not replaced. A unit left
  with no neighbours is left out of that week.
- **Cluster classes.** Local Moran on C2 (row-standardised W), conditional permutation (999), BH
  FDR over units within a week. "High-signal cluster" = significant HH, "isolated high signal" =
  significant HL. Both also need the unit's own C2 > 1, the excess cut-off C3 uses, so that a unit
  only just above a low weekly mean is not called high. Gi* (binary W, self included) is reported
  alongside.
- **Moran's I outliers.** C2 is heavy-tailed (99th percentile 9.7, maximum 94.7), so global
  Moran's I is also run on the ranks of C2 as a check.
- **Episodes for Knox.** An episode is a run of EARS alarm weeks, with one-week gaps merged.
  Closeness is neighbours under the weights (symmetrised) and starts within 2 weeks. The null
  permutes start weeks across all weeks (as specified) and, more strictly, within each epi year.
- **Province level (MAUP).** 83 units: the 81 provinces with their cities, NCR as one unit and
  Zamboanga City on its own (neither has a province).
- **Lead time (step 7).**
  - An aggregate threshold episode is 2+ consecutive weeks at the DOH epidemic level (or at alert
    or above), as in `ml/qa/ears_analysis.py`.
  - The onset counts only when the week before it was evaluated and below the threshold.
    Thresholds start in 2019, and 2019-01-06 is missing for every unit, so many January 2019
    "onsets" were never observed.
  - The search window is the 8 weeks before onset through the episode's end.
  - Three local rules are compared: any member unit alarming; 2+ members in the same week; and
    more members than in 95% of off-season (Dec–May) weeks of 2016–2018 (the "calibrated
    count"). The calibration uses only 2016–2018.
  - Each rule's rate in 9-week windows that touch no episode is reported, so an "early warning"
    can be weighed against how often the same rule fires anyway.
  - The national sum's own threshold onset is censored, so the national comparison uses DOH's
    announcements (alert 15/07/2019, epidemic 06/08/2019).
- **Out of time.** No parameter was tuned on any period. Every result is reported separately for
  2016–2018 and 2019–2021.

## 5. How results may be shown on the map

The SIGMA map mode draws **points** for every layer, and optional **area fills** (geoBoundaries
polygons dissolved to the reporting units) for the categorical EARS and DOH states only. The rules
below are what that mode implements.

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
| Swap rows (A4) | Not handled; `deaths` is dropped, so the swap cannot be seen | **Fixed 2026-10-21** (`clean_dengue.mark_suspect_swaps`; the 665 rows are `data_quality = "suspect swap"`, so the warning below no longer applies). Originally tracked as a separate fix to `clean_dengue.py`, agreed in review of the geography PR. 611 of the 665 rows hold 0 cases and are kept as `ok`. Only 13 get a `data_flag` (the blocks alternate weeks, so the 4-zero-week rule rarely fires). |
| Date semantics (A5) | `date` taken as the week start | Open. National lead times use OpenDengue and are not affected; local timing may shift by 1–2 weeks. |
| Davao del Sur + Occidental merge | Davao Occidental 2016 is null | Acceptable; merge still needed for any 2016 map |

**Effect of the swap rows on PR #2 results.** This is a Node re-implementation of the local half of the two scripts, not their actual output. Treating the 665 rows as missing:
- flips the EARS alarm / no-alarm result on 120 other unit-weeks (2016: 30, 2017: 35, 2020: 52, 2021: 3);
- changes the DOH status of 86 other unit-weeks, through the 2016–2017 baseline years.

The 2019 national findings are not affected. Proposed fix for `clean_dengue.py`: mark the rows as `data_quality = "suspect swap"` before `deaths` is dropped. Use the rule in `scripts/geo/build-geo.mjs`: a row out of date order in a week where at least 10 units have one.

*(Historical; the fix landed on 2026-10-21 and the EARS workbook has been rebuilt since.)*
**Until that fix lands, do not rely on local (reporting-unit) EARS results for 2016, 2017, 2020 and
January 2021, or on any local DOH-threshold result** (these start in 2019, and their 3-year
baselines include 2016, 2017 or 2020; report §5.1). National results are not affected.

**Why not "deaths > cases"?** The documentation audit on `docs/documentation-pack` counts 586 rows
with deaths > cases. 581 of them are swap rows; the other 5 are isolated rows outside the blocks.
That rule would miss 84 of the 665 swap rows (those with deaths ≤ cases), so the fix should use the
swap-block rule above.

### 6.2 Results and what they mean (2026-10-24)

Numbers are from [spatial-analysis-report.md](spatial-analysis-report.md) (seed 20261024; a
rebuild is byte-identical). Hackathon prototype; these are findings about reported signals, not
validated public-health claims.

**In plain language.** Dengue warning signals do bunch up on the map, and alarms in neighbouring
places tend to start in the same few weeks. Both results survive every check. Pinpointing *which*
places form a cluster in a given week is not reliable yet: it depends too much on how
"neighbour" is defined. Watching the 126 places one by one did not warn earlier than watching
each region's total, once the local rule is held to the same false-alarm rate. Nationally it was
one week earlier.

1. **Global clustering is real and robust.**
   - Weekly Moran's I of C2 is significant (FDR) in 61% of the 212 analysable weeks under W1, 57%
     under W3 and 46% under W2. W2's 270 km band gives a median of 35 neighbours and dilutes it.
   - It also holds on ranks (78%), with swap rows swapped back (64%), without 2016 (63%) and at
     province level (56%; weekly series correlation 0.75).
   - Shuffling unit locations removes it: 0% of weeks significant after FDR, 5% at raw p ≤ 0.05.
   - **It is not specific to 2019.** The 2019 June–November season is about as clustered as other
     seasons (77% vs 78% of weeks; median I 0.20 vs 0.18). The epidemic declaration week has
     I = 0.23, q = 0.003. Clustering is a normal feature of the dengue season and does not single
     out an epidemic on its own.
2. **Local clusters are not stable enough to put on the map.**
   - Under W1 only 120 of 26,465 unit-weeks are a high-signal cluster.
   - W1 and W3 agree on 20 of them (κ 0.23). W2 calls 1,254 (κ 0.11 with W1), because its huge
     neighbourhoods behave like regional averages.
   - Gi* hot spots almost all coincide with W1 clusters (75 of 75), so the instability comes from
     the weights, not from the choice of statistic.
   - The June–September 2019 W1 clusters are in Western Visayas (Panay, Negros Occidental) and
     around Metro Manila / Central Luzon. They match where the epidemic was declared only loosely:
     14% of units in the four "epidemic" regions of 15/07/2019 were in a cluster before that date,
     5.5% in "alert" regions and 0% elsewhere.
   - **Decision for the map (§5):** do not add a per-unit cluster layer yet. If one is added later,
     show only classes that agree under W1 and W3, and label them as in §5.
3. **Alarm starts are space-time clustered.**
   - Knox ratio 1.22 under W1 (p = 0.001), and 1.17 when start weeks are permuted only within the
     same epi year. It holds in 2016–2018 and 2019–2021, under W3 (1.30) and at province level
     (1.24), with swap rows swapped back and without 2016.
   - Under W2 it is weak in 2019–2021 (1.05, p = 0.06).
   - Shuffled locations give 1.01 (range 0.94–1.10).
   - This is consistent with spread, or with shared drivers such as weather, between neighbouring
     units. The test cannot tell the two apart.
4. **Local versus aggregate lead time: the proposal's claim is not supported at regional scale.**
   - "Any member unit alarmed" does come earlier than the regional series in 17 of 37 comparable
     epidemic episodes. But it fires in 71% of quiet 9-week windows, so it is not a usable warning.
   - With the calibrated count, which fires in 27% of quiet windows against the regional series'
     own 34%, local signals came first in 4 episodes, at the same time in 19 and later in 13.
     Pooling units into a regional total gains power; it does not hide timing.
   - Nationally, units crossed the calibrated count (24 units in the same week) on 2019-06-02, one
     week before the national sum's first alarm (2019-06-09). That is 6 weeks before DOH's alert
     and 9 weeks before the epidemic declaration.
   - Every one of these results is the same in the swapped-back and no-2016 variants.
   - All timings carry the HDX `date` uncertainty (A5): 1–2 weeks either way.

**Consequences for other modules.**
- Map (`web/`): no cluster layer for now (point 2).
- `docs/dengue-pipeline.md` key findings: the EARS-vs-DOH lead time is unaffected. Add that
  local-first alerting gives no regional gain (point 4).
- `/api/v1/dengue/signals`: the weekly Moran's I and Knox results could be served as national
  context once EARS is connected.

## 7. Geography for the environment track (PR #1, CCHAIN)

Added 2026-10-21. Answers PR #1 open question 2 ("Does the geography track's canonical ID map to
CCHAIN's codes?"): **yes, for all 12 cities.**

| What | Result | Evidence |
| --- | --- | --- |
| CCHAIN code → canonical geography | All 12 cities match a COD-AB v03 city by code rule (`PH` + region + `0` + province + city), name and area (CCHAIN barangays cover 99.9–100.1% of each city) | `data/reference/geo/cchain_city_crosswalk.csv`; report §8 |
| CCHAIN city → HDX reporting unit | 10 cities are their own HDX unit (`same_area`). Palayan sits inside Nueva Ecija and Legazpi inside Albay (`inside_unit`) | same |
| Current PSA code | Filled for all 12 (`psa_psgc_code`, PSA PSGC 3Q 2026) | same |
| Barangay lists | Same count for 11 cities. Navotas: 14 in CCHAIN, 18 in COD-AB v03, same total area | report §8 |

This matches the environment track's own finding of "10 shared cities". The crosswalk matches
**areas only**. CCHAIN's Iloilo City case series behaves like Iloilo *province* (PR #1 §4.3), which is a
data problem that a code mapping cannot fix.

**Rules for weather–dengue joins (proposed):**
- Join on the canonical id (`hdx_unit_id` / `geographic_entity_id`), never on names or on the prefix of
  a PSGC code.
- A weather value must describe the **same area** as the case count. For `same_area` cities, CCHAIN
  city weather and HDX city counts can be joined. For `inside_unit` cities (Palayan, Legazpi), city
  weather must not be joined to the province's HDX counts.
- For units outside CCHAIN (the planned Open-Meteo fallback), a single point is not area weather. A
  province or province remainder needs an area or population-weighted mean over the municipalities
  it contains (its province's `codAbPcodes` minus the cities in `excludes`), not the value at
  `rep_lat`/`rep_lon`. The
  representative point is for map labels only.
- Before CCHAIN and Open-Meteo feed the same model, compare them on the 12 CCHAIN cities over
  their shared years, using the same weekly aggregation. Both use ERA5 for temperature, but
  CCHAIN rainfall is CHIRPS, so rainfall is the likelier source of disagreement. Open-Meteo's free
  tier is non-commercial only (PR #1 §2).
- **ENVIRONMENT tab:** one row per canonical geography × week, with `geography_id` set to the canonical
  id, `geographic_level`, an `aggregation_method` (for example population-weighted barangay mean),
  source, coverage days and quality flags, as PR #1 §9.1 proposes.

**Week convention (owned by Physics 1, not decided here).** Two independent checks agree that HDX
dates sit about 1–2 weeks **after** the week they describe: report §6 (best fit with OpenDengue at
HDX − 7 days) and PR #1 §4.2 (best fit with CCHAIN Mondays at HDX − 13 days). Climate lags should
therefore be reported for lag windows, as PR #1 proposes, until the `date` meaning is confirmed (A5).
