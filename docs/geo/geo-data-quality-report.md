# Geographic data-quality report — HDX DOH-Epi dengue 2016–2021

> **Generated** by `scripts/geo/build-geo.mjs` (geo-1.0.0). Do not edit by hand; change the curated
> inputs in `data/reference/geo/` and rerun. Interpretation and recommendations are in
> [spatial-assessment-and-method.md](spatial-assessment-and-method.md).

## 1. Inputs

| Input | File | SHA-256 | Licence | Retrieved |
| --- | --- | --- | --- | --- |
| Philippine Dengue Cases and Deaths — DOH-Epi Dengue Data 2016-2021.csv | `data/raw/hdx_dengue/doh-epi-dengue-data-2016-2021.csv` | `4e993553f10081b4…` | CC BY (Creative Commons Attribution International) | 2026-10-17 |
| Philippines - Subnational Administrative Boundaries (COD-AB v03), tabular attributes | `data/raw/cod_ab_phl/phl_admin_boundaries.xlsx` | `3fbaa5f9aab05896…` | CC BY-IGO | 2026-10-17 |
| Philippines - Subnational Population Statistics, admin 1, 2022 projection | `data/raw/cod_ps_phl/phl_admpop_adm1_2022.csv` | `40ac6ef448da1231…` | CC BY-IGO | 2026-10-17 |
| Philippines - Subnational Population Statistics, admin 2, 2022 projection (v2) | `data/raw/cod_ps_phl/phl_admpop_adm2_2022_v2.csv` | `dd06a7d799371900…` | CC BY-IGO | 2026-10-17 |
| Philippine Standard Geographic Code (PSGC), 3rd Quarter 2026 publication datafile | `data/raw/psa_psgc/PSGC-3Q-2026-Publication-Datafile.xlsx` | `8aad47f84e4f6317…` | PSA terms of use; kept in git-ignored data/raw, not redistributed | 2026-10-19 |

- Boundary reference: OCHA COD-AB PHL **v03**, valid on 2025-02-13: 17 regions, 88 admin-2, 1,642 admin-3 units.
- The dengue file is published on HDX by **Cirrolytix** (a third party), attributed to DOH-EB. Its description calls the counts "confirmed", then says they include suspect, probable and confirmed cases. Treat the case definition as **total reported (suspect + probable + confirmed)**.
- HDX metadata lists the file as 1,599,449 bytes, but the download is 1,597,948 bytes. The cause is unknown; the metadata may be from an earlier upload. The SHA-256 above identifies the copy SIGMA uses.

## 2. File structure

| Check | Result |
| --- | --- |
| Header | `loc,cases,deaths,date,Region` |
| Row 2 (HXL tags, treated as metadata) | `#adm2+name,#affected+infected,#affected+killed,#date,#region` |
| Data rows | 32,701 |
| Rows with ≠ 5 fields | 0 |
| Unparseable dates (expected M/D/YYYY) | 0 |
| Dates not on a Sunday | 0 |
| Dates off the 7-day grid from 2016-01-10 | 0 |
| Date range | 2016-01-10 → 2021-01-10 (262 weekly slots) |
| Non-integer / negative cases | 0 |
| Missing deaths | 1 (line 12777: QUEZON CITY 5/7/2017) |
| Deaths > cases | 586 (ABRA 9/4/2016: 4 > 0; ABRA 9/18/2016: 35 > 0; ABRA 10/2/2016: 2 > 0; ABRA 10/16/2016: 2 > 0; ABRA 10/30/2016: 1 > 0) |
| Duplicate location-week rows | 0 |

**The `#adm2+name` HXL tag on `loc` is wrong.** The column mixes 81 provinces, 44 cities and 1 municipality. They are DOH reporting units, not one administrative level. Any tool that trusts the tag will mis-join the 45 city and municipal rows to admin-2 polygons.

## 3. Identifier audit

### 3.1 Raw identifier problems

| Problem | Identifiers |
| --- | --- |
| Leading or trailing whitespace in `loc` | `" CAGAYAN DE ORO CITY"`, `" NEGROS ORIENTAL"` |
| Same name spelled two ways in the raw file | none |
| Misspellings (fixed through `name_overrides.csv`) | SISQUIJOR → SIQUIJOR, NUEVA VISCAYA → NUEVA VIZCAYA, BASILIG CITY → BISLIG CITY |
| Non-standard names | TACLOBAN → TACLOBAN CITY |
| Boundary-vintage names | NORTH COTABATO, MAGUINDANAO (see §4) |
| Region labels with inconsistent casing | `Region I-ILOCOS REGION`, `Region II-CAGAYAN VALLEY` |
| Region label with the wrong numeral | `REGION VII-EASTERN VISAYAS`: every member is in Region VIII (PH08). It is mapped by membership. |
| Anachronistic region label | `BARMM` is used for 2016–2018, when the region was ARMM. |

### 3.2 Matching results

- Source identifiers: **126**. Matched: **126**. **Unmatched: 0.** **Ambiguous: 0.**
- How each was matched: exact 118, manual_typo 3, normalized 2, manual_vintage 2, manual_name 1.
- Reporting-unit types: province_full 59, province_remainder 22, city_huc 33, city_cc 6, city_icc 5, municipality 1.
- City classes (curated in `city_classes.csv`): HUC 33, ICC 5, CC 6. Every class agrees with PSA PSGC 3Q 2026 (checked on every build). PSA lists 33 HUCs and 5 ICCs, and **every** one is a separate reporting unit. The other 6 cities are component cities, 5 of them in Caraga.

### 3.2a PSA PSGC codes

- All 128 COD-AB codes used by the 126 units resolve to a PSA PSGC 3Q 2026 code: exact 88, correspondence 38, name 2.
- **exact**: the code derived from the COD-AB pcode is a current PSGC code. **correspondence**: COD-AB keeps an older code (HUCs, NCR, Negros and Siquijor before the 2024 Negros Island Region); it equals PSA's 9-digit Correspondence Code. **name**: the area moved region and got a new code (Sulu, now Region IX; the Special Geographic Area, now in BARMM).
- Units whose current PSA region differs from the source-period region: bacolod-city (1830200000), cotabato (1204700000+1999900000), cotabato-city (1908703000), negros-occidental-remainder (1804500000), negros-oriental (1804600000), siquijor (1806100000), sulu (0906600000). Analysis keeps the source-period region (`analysis_region_id`). Never aggregate by code prefix.
- No single current code (blank `psgc_code` in the hub rows): every province remainder, plus cotabato, maguindanao-remainder.

### 3.3 Duplicate and one-to-many mappings

- Two source identifiers mapped to the same COD-AB unit: **0**.
- One source identifier mapped to several COD-AB admin-2 units, for boundary-vintage reasons: **MAGUINDANAO** → PH19087 + PH19088; **NORTH COTABATO** → PH12047 + PH19099.
- SIGMA unit ids are unique: yes.

### 3.4 Partition test

Every COD-AB admin-3 unit must belong to exactly one reporting unit. Result: 1,642 of 1,642 assigned, 0 orphaned, 0 assigned twice. **The 126 reporting units are mutually exclusive and cover the whole country.** This is what makes summing units up to provinces and regions geographically valid.

### 3.5 Province rows that exclude separately reported cities

22 province rows do **not** cover the whole province. The cities inside them are reported on their own rows. The other 59 province rows do cover the whole province.

| Province (source) | Reporting unit id | Excludes |
| --- | --- | --- |
| AGUSAN DEL NORTE | `agusan-del-norte-remainder` | BUTUAN CITY, CABADBARAN CITY |
| AGUSAN DEL SUR | `agusan-del-sur-remainder` | BAYUGAN CITY |
| BENGUET | `benguet-remainder` | BAGUIO CITY |
| CAMARINES SUR | `camarines-sur-remainder` | NAGA CITY |
| CEBU | `cebu-remainder` | CEBU CITY, LAPU-LAPU CITY, MANDAUE CITY |
| DAVAO DEL SUR | `davao-del-sur-remainder` | DAVAO CITY |
| ILOILO | `iloilo-remainder` | ILOILO CITY |
| ISABELA | `isabela-remainder` | SANTIAGO CITY |
| LANAO DEL NORTE | `lanao-del-norte-remainder` | ILIGAN CITY |
| LEYTE | `leyte-remainder` | ORMOC CITY, TACLOBAN CITY |
| MAGUINDANAO | `maguindanao-remainder` | COTABATO CITY |
| MISAMIS ORIENTAL | `misamis-oriental-remainder` | CAGAYAN DE ORO CITY |
| NEGROS OCCIDENTAL | `negros-occidental-remainder` | BACOLOD CITY |
| PALAWAN | `palawan-remainder` | PUERTO PRINCESA CITY |
| PAMPANGA | `pampanga-remainder` | ANGELES CITY |
| PANGASINAN | `pangasinan-remainder` | DAGUPAN CITY |
| QUEZON | `quezon-remainder` | LUCENA CITY |
| SOUTH COTABATO | `south-cotabato-remainder` | GENERAL SANTOS CITY |
| SURIGAO DEL NORTE | `surigao-del-norte-remainder` | SURIGAO CITY |
| SURIGAO DEL SUR | `surigao-del-sur-remainder` | BISLIG CITY, TANDAG CITY |
| ZAMBALES | `zambales-remainder` | OLONGAPO CITY |
| ZAMBOANGA DEL SUR | `zamboanga-del-sur-remainder` | ZAMBOANGA CITY |

Curated parent provinces in `city_classes.csv` disagree with COD-AB nesting in 1 case(s): ISABELA CITY (curated BASILAN, COD-AB (own admin-2 / NCR); Component city of Basilan but administratively in Region IX; COD-AB gives it its own admin-2 unit (PH09097), so Basilan's admin-2 polygon already excludes it).

## 4. Boundary and naming inconsistencies (source period vs COD-AB v03)

Source-period region compared with the COD-AB v03 region of each unit's territory: 2 unit(s) differ.

| Unit | Source region | COD-AB v03 region(s) | Status | Why |
| --- | --- | --- | --- | --- |
| NORTH COTABATO | PH12 | PH12 + PH19 | partial | COD-AB names the province 'Cotabato (North Cotabato)'. Before the 2024 creation of the BARMM Special Geographic Area (PH19099), its 63 barangays belonged to North Cotabato municipalities (Carmen, Kabacan, Midsayap, Pigkawayan, Pikit). The 2016-2021 reporting unit is therefore taken as PH12047 + PH19099. ASSUMPTION: reporting for those barangays stayed with North Cotabato LGUs through 2021; unverified. |
| COTABATO CITY | PH12 | PH19 | differs | Geographically enclosed by Maguindanao; administratively Region XII in the source period, BARMM after the 2019 plebiscite |

Other boundary changes that affect 2016–2021:

- **Negros Island Region** (2015-05-29 to 2017-08-09). Negros Occidental and Bacolod are placed in Region VI, and Negros Oriental in Region VII, for every year. Regional totals for 2016 to mid-2017 therefore follow the post-2017 regions, not the regions legally in force at the time.
- **Compostela Valley → Davao de Oro** (renamed in December 2019). The source uses the new name throughout. COD-AB lists the old name as an alias. Matched to a single unit; nothing is lost.
- **Maguindanao split (2022).** The source province equals Maguindanao del Norte + del Sur in COD-AB v03, minus Cotabato City.
- **Special Geographic Area (BARMM, PH19099).** Its 63 barangays came from North Cotabato municipalities. They are assigned to the North Cotabato unit for 2016–2021. This is an **unverified assumption**.
- **Cotabato City.** The source keeps it in Region XII. COD-AB v03 puts it in BARMM / Maguindanao del Norte. SIGMA uses the **source-period region** (`analysis_region_id`) for regional aggregation.
- **Isabela City.** It is administratively in Region IX but geographically on Basilan. COD-AB gives it its own admin-2 unit, so Basilan's polygon already excludes it.

## 5. Temporal coverage by unit

A unit-week is **usable** when the row exists and is not a suspected swap row (§5.1).

- Weekly slots: 262. Weeks where all 126 units have a usable row: **197**. Weeks with at least one unit missing or suspect: 65. Weeks with **no rows for any unit**: 2019-01-06.
- Incomplete weeks per year: 2016: 51, 2017: 7, 2018: 0, 2019: 1, 2020: 6. 2021 has 2 weekly slot(s), so it is not a season.
- Gaps between consecutive rows, by length in days: 14 d × 259. 126 of these are the single nationwide missing week 2019-01-06. The 14-day gaps are therefore mostly **missing weeks**, not a fortnightly reporting cycle.
- Units with at least one gap: 126 of 126. Missing unit-weeks in total: 311 of 33,012. Suspect unit-weeks: 665.
- Unit-years below 90% usable completeness (2016–2020): 134: ABRA 2016 (45/51), ABRA 2020 (46/52), AGUSAN DEL NORTE 2016 (45/51), AGUSAN DEL NORTE 2020 (46/52), AGUSAN DEL SUR 2016 (45/51), AGUSAN DEL SUR 2020 (46/52), AKLAN 2017 (47/53), ANTIQUE 2017 (47/53), APAYAO 2016 (45/51), APAYAO 2020 (46/52), BACOLOD CITY 2017 (47/53), BAGUIO CITY 2016 (45/51), BAGUIO CITY 2020 (46/52), BASILAN 2016 (45/51), BASILAN 2020 (46/52), BASILIG CITY 2016 (45/51), BASILIG CITY 2020 (46/52), BAYUGAN CITY 2016 (45/51), BAYUGAN CITY 2020 (46/52), BENGUET 2016 (45/51), BENGUET 2020 (46/52), BILIRAN 2017 (47/53), BOHOL 2017 (47/53), BUKIDNON 2017 (47/53), BUTUAN CITY 2016 (45/51), BUTUAN CITY 2020 (46/52), CABADBARAN CITY 2016 (45/51), CABADBARAN CITY 2020 (46/52), CAGAYAN DE ORO CITY 2017 (47/53), CALOOCAN CITY 2016 (45/51), CALOOCAN CITY 2020 (46/52), CAMIGUIN 2017 (47/53), CAPIZ 2017 (47/53), CEBU 2017 (47/53), CEBU CITY 2017 (47/53), COTABATO CITY 2016 (45/51), COTABATO CITY 2020 (46/52), DAVAO CITY 2017 (47/53), DAVAO DE ORO 2017 (47/53), DAVAO DEL NORTE 2017 (47/53), ….
- **Davao Occidental has no rows in 2016.** The province was created from Davao del Sur in 2013, and its 2016 cases may be inside the Davao del Sur row. The data cannot confirm this. Any analysis that includes 2016 should merge the two into one consistent-geography unit, or drop Davao Occidental in 2016. It must not treat the unit as zero.

Missing weeks are absent rows. They are **never** zero. Full per-unit, per-year table: `data/processed/geo/hdx_unit_year_coverage.csv`.

### 5.1 Suspected cases↔deaths column swap (spatially structured)

- 801 rows are out of chronological order within their unit. They are appended after later weeks of the same unit.
- **Swap blocks** are the 15 weeks in which ≥ 10 units have an appended row. 665 rows fall in them. In those rows `cases` is 0 in 611, 1 in 46, and higher in 8.
- The other 136 out-of-order rows belong to 4 units (ANGELES CITY, GENERAL SANTOS CITY, PATEROS, PUERTO PRINCESA CITY). They are ordering anomalies only. Sort by date; the values are kept.
- In those 665 rows, the `deaths` value tracks the unit's adjacent-week case counts: Pearson r = **0.917** on log(1+x), n = 665. The median of deaths ÷ adjacent cases is 0.86.
- The pattern is very likely **cases and deaths swapped**. The case count sits in `deaths`, and a death count (usually 0 or 1) sits in `cases`. This explains why annual death totals are inflated, and why 581 of the 586 rows with deaths > cases fall in the swap blocks. The other 5 are isolated rows (BATANES 11/19/2017; QUIRINO 10/15/2017; DAVAO DEL SUR 5/13/2018; PATEROS 5/20/2018; AURORA 9/15/2019). A "deaths > cases" rule is therefore **not** a substitute for the swap-block rule: it misses the 84 swap rows where deaths ≤ cases.
- **It is regional.** Whole regions are affected in specific alternating weeks:

| Source region | Year | Units | Weeks | Rows |
| --- | --- | --- | --- | --- |
| BARMM | 2016 | 5 | 2016-09-04 2016-09-18 2016-10-02 2016-10-16 2016-10-30 | 25 |
| CAR | 2016 | 7 | 2016-09-04 2016-09-18 2016-10-02 2016-10-16 2016-10-30 | 35 |
| CARAGA | 2016 | 11 | 2016-09-04 2016-09-18 2016-10-02 2016-10-16 2016-10-30 | 55 |
| NATIONAL CAPITAL REGION | 2016 | 17 | 2016-09-04 2016-09-18 2016-10-02 2016-10-16 2016-10-30 | 85 |
| REGION XII-SOCCSKSARGEN | 2016 | 6 | 2016-09-04 2016-09-18 2016-10-02 2016-10-16 2016-10-30 | 30 |
| REGION IX-ZAMBOANGA PENINSULA | 2017 | 5 | 2017-09-03 2017-09-17 2017-10-01 2017-10-15 2017-10-29 | 25 |
| REGION VI-WESTERN VISAYAS | 2017 | 8 | 2017-09-03 2017-09-17 2017-10-01 2017-10-15 2017-10-29 | 40 |
| REGION VII-CENTRAL VISAYAS | 2017 | 7 | 2017-09-03 2017-09-17 2017-10-01 2017-10-15 2017-10-29 | 35 |
| REGION VII-EASTERN VISAYAS | 2017 | 8 | 2017-09-03 2017-09-17 2017-10-01 2017-10-15 2017-10-29 | 40 |
| REGION X-NORTHERN MINDANAO | 2017 | 7 | 2017-09-03 2017-09-17 2017-10-01 2017-10-15 2017-10-29 | 35 |
| REGION XI-DAVAO REGION | 2017 | 6 | 2017-09-03 2017-09-17 2017-10-01 2017-10-15 2017-10-29 | 30 |
| BARMM | 2020 | 5 | 2020-09-06 2020-09-20 2020-10-04 2020-10-18 2020-11-01 | 25 |
| CAR | 2020 | 7 | 2020-09-06 2020-09-20 2020-10-04 2020-10-18 2020-11-01 | 35 |
| CARAGA | 2020 | 11 | 2020-09-06 2020-09-20 2020-10-04 2020-10-18 2020-11-01 | 55 |
| NATIONAL CAPITAL REGION | 2020 | 17 | 2020-09-06 2020-09-20 2020-10-04 2020-10-18 2020-11-01 | 85 |
| REGION XII-SOCCSKSARGEN | 2020 | 6 | 2020-09-06 2020-09-20 2020-10-04 2020-10-18 2020-11-01 | 30 |

**Swap test against OpenDengue** (swap-block weeks; OpenDengue week = HDX date − 7 days):

| HDX week | Suspect rows | HDX sum as published | HDX sum, suspect rows swapped back | OpenDengue |
| --- | --- | --- | --- | --- |
| 2016-09-04 | 46 | 6,705 | 8,423 | 8,089 |
| 2016-09-18 | 46 | 5,465 | 7,000 | 6,789 |
| 2016-10-02 | 46 | 4,273 | 5,640 | 4,949 |
| 2016-10-16 | 46 | 3,891 | 5,016 | 4,061 |
| 2016-10-30 | 46 | 3,494 | 4,812 | 1,619 |
| 2017-09-03 | 41 | 3,704 | 4,584 | 4,794 |
| 2017-09-17 | 41 | 3,212 | 4,062 | 4,025 |
| 2017-10-01 | 41 | 2,810 | 3,537 | 3,422 |
| 2017-10-15 | 41 | 2,772 | 3,406 | 2,985 |
| 2017-10-29 | 41 | 2,970 | 3,598 | 3,129 |
| 2020-09-06 | 46 | 1,177 | 1,360 | 1,185 |
| 2020-09-20 | 46 | 1,186 | 1,318 | 1,169 |
| 2020-10-04 | 46 | 942 | 1,084 | 877 |
| 2020-10-18 | 46 | 980 | 1,154 | 931 |
| 2020-11-01 | 46 | 944 | 1,128 | 986 |

- **2016–2017:** swapping the suspect rows back brings most block weeks into line with OpenDengue. This supports the swap hypothesis.
- **2020:** the as-published sums match better. This is not independent evidence against the swap. OpenDengue's 2020 weeks come from `MOH-PHL` upstream records (MOH-PHL-2020-Y02-01), which may be built from the same DOH tables and carry the same error.

**Handling rule (proposed to the cleaning workstream):** treat cases and deaths in these rows as **missing**. Never treat them as 0, and never swap them back silently. A swap-back can be offered as a documented sensitivity analysis. Because whole regions drop out in the same weeks, leaving these zeros in would draw a **false regional dip** in any map or spatial statistic, and a false drop in EARS baselines.

## 6. Consistency with the national OpenDengue series (cross-check only)

**The two series are compared here, never merged.** The first table counts usable rows only.

| Year | HDX sum (usable rows) | Complete weeks | OpenDengue national | Ratio |
| --- | --- | --- | --- | --- |
| 2016 | 209,511 | 0 | 175,316 | 1.195 |
| 2017 | 154,124 | 46 | 135,728 | 1.136 |
| 2018 | 250,783 | 52 | 215,740 | 1.162 |
| 2019 | 441,902 | 51 | 435,232 | 1.015 |
| 2020 | 91,040 | 46 | 81,500 | 1.117 |

**Exclusivity test.** Do province rows already include their separately reported cities? The test uses complete weeks only, with OpenDengue week = HDX date − 7 days.

- If they **do not** (the reporting units are exclusive), the true total is the HDX sum.
- If they **do**, the cities are counted twice, and the true total is the HDX sum minus the city rows.

| Year | Weeks | City share of HDX sum | Ratio if exclusive | Ratio if cities double-counted |
| --- | --- | --- | --- | --- |
| 2017 | 42 | 31.5% | 1.106 | 0.758 |
| 2018 | 51 | 23.7% | 1.152 | 0.879 |
| 2019 | 51 | 20.8% | 1.023 | 0.810 |
| 2020 | 46 | 21.3% | 1.090 | 0.859 |

Weekly alignment of the HDX sum against OpenDengue `periodStart` (complete weeks only, log scale):

| HDX date + offset | Weeks matched | Pearson r (log) | Median HDX / OD |
| --- | --- | --- | --- |
| -14 d | 192 | 0.9643 | 1.046 |
| -7 d | 192 | 0.9498 | 1.060 |
| +0 d | 192 | 0.9249 | 1.091 |
| +7 d | 192 | 0.8940 | 1.120 |

Reading:

- **Exclusivity.** Under the exclusive reading, the HDX total is consistently a little **above** OpenDengue. Under the double-counting reading, it is well **below**: cities are 21–31% of the total. The exclusive reading is closer in most years, and very close in 2019.
- The exclusive reading also agrees with the partition structure (§3.4) and with the DOH practice of reporting HUCs and ICCs as separate units. It is **supported, not proven**. If DOH-EB confirms it, the assumption can be removed.
- **Date alignment.** The best alignment is with HDX dates shifted 1–2 weeks **earlier**. The HDX `date` is therefore probably not the morbidity-week start; it may be an end-of-week or report date. **Unresolved.** This affects EARS lead-time and is referred to the temporal/EARS workstream.
- **Other differences** may come from the case definition, reporting delays and later revisions. OpenDengue mixes WHO WPRO and MOH sources.

## 7. Population denominators (COD-PS)

- COD-PS admin-2 2022 has 84 rows. Rows whose `ADM2_PCODE` matches a COD-AB v03 admin-2 pcode: **0**. COD-PS uses the older 9-digit PSGC-style P-codes (for example ARMM = PH15…), so it cannot be joined to COD-AB v03 without a crosswalk.
- COD-PS has 1 NCR row(s) and no city-level rows. It cannot give denominators for the 44 separately reported cities, and so it cannot give denominators for the province remainders either.
- The projections are for 2022–2025. The dengue data covers 2016–2021.
- **Result: no valid population denominator exists today at reporting-unit level.** Incidence rates are not supported. See the assessment document.
