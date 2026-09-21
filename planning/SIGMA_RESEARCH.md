# SIGMA — Philippine Public-Health Intelligence & Spatiotemporal Simulation Platform

## Research Document

**Date:** 2026-09-21
**Status:** Pre-design research phase (no code written)
**Scope:** Dataset sourcing, methodology selection, and competitive landscape for a Philippine public-health intelligence platform

---

## Table of Contents

- [Section 1: Philippine Public-Health Datasets](#1-philippine-public-health-datasets)
- [Section 2: DOH / FHSIS / Surveillance Datasets](#2-doh--fhsis--surveillance-datasets)
- [Section 3: LGU Health Data](#3-lgu-health-data)
- [Section 4: Philippine News/RSS Sources for Event-Based Surveillance](#4-philippine-newsrss-sources-for-event-based-surveillance)
- [Section 5: Geographic Datasets (Municipalities/Barangays)](#5-geographic-datasets-municipalitiesbarangays)
- [Section 6: Historical Disease Data for Backtesting](#6-historical-disease-data-for-backtesting)
- [Section 7: Existing Public-Health Intelligence Systems](#7-existing-public-health-intelligence-systems)
- [Section 8: Academic Methods](#8-academic-methods)
- [Section 9: Recommendations](#9-recommendations)
  - A. Recommended MVP Dataset
  - B. Recommended Disease/Use-Case
  - C. Recommended ML/Statistical Methodology
  - D. Recommended Spatial Model
  - E. Validation/Backtesting Methodology
  - F. Data-Source Acquisition Plan
  - G. Risks and Limitations
  - H. Existing Similar Projects to Differentiate From

---

## 1. Philippine Public-Health Datasets

### 1.1 Department of Health (DOH) Philippines

- **URL:** https://www.doh.gov.ph/
- **Description:** The national health authority. Publishes health statistics, disease surveillance reports, and policy documents. Has a statistics page linked from RITM.
- **Accessibility:** Website is live but bulk data downloads are inconsistent. No single open-data portal comparable to data.gov. Historical weekly surveillance reports are available on request or through RITM.
- **Geographic resolution:** National, with some regional breakdowns.
- **Temporal resolution:** Monthly/annual reports; weekly data available through surveillance systems (FHSIS).
- **Licensing:** Government data; generally unrestricted but no formal open-data license documented.
- **Verified fact:** DOH statistics page is linked at https://doh.gov.ph/statistics (confirmed from RITM surveillance data page).

### 1.2 FHSIS (Field Health Service Information System)

- **URL:** No standalone public URL; data is accessible through DOH and RHU (Regional Health Units)
- **Description:** FHSIS is the national routine disease surveillance system in the Philippines. It collects weekly case reports from health facilities nationwide through the "Weekly Report" (RPT) form. It covers notifiable diseases including dengue, measles, cholera, influenza-like illness, and more.
- **Accessibility:** NOT publicly accessible as an open dataset. Data is aggregated at the barangay/municipal level and reported up through provincial and regional health units. Access requires coordination with DOH or LHOs.
- **Geographic resolution:** Barangay-level (smallest administrative unit) ideally, but in practice often aggregated to municipality or province.
- **Temporal resolution:** Weekly reporting (epiweeks).
- **Licensing:** Government data; not openly published.
- **Verified fact:** FHSIS is the Philippine national disease surveillance system. Weekly reporting is the standard (confirmed by DOH surveillance framework documentation).
- **Suggestion:** The FHSIS weekly report data may be the single most valuable dataset for this project, but obtaining structured, machine-readable data is the primary challenge.

### 1.3 RITM (Research Institute for Tropical Medicine) Surveillance Data

- **URL:** https://ritm.gov.ph/data/surveillance/
- **Description:** RITM serves as the National Referral Center for Emerging and Re-emerging Diseases. The Surveillance and Response Unit (SRU) monitors laboratory samples, reports trends to the DOH Epidemiology Bureau and NCDPC, and provides early signals of outbreaks.
- **Accessibility:** Partially accessible. The surveillance data page provides PDF fact sheets, media monitoring reports, and links to DOH statistics. A Google Drive link is provided for "Temporary repository of Global Surveillance Updates." RITM also publishes an "Infectious Disease Incidence Data" page at https://ritm.gov.ph/data/infectious-disease-incidence-data/
- **Geographic resolution:** National and regional (laboratory-confirmed cases).
- **Temporal resolution:** Periodic (media monitoring reports are published ~weekly during outbreaks).
- **Licensing:** Government publication; freely accessible PDFs.
- **Verified fact:** RITM SRU was created through Office Order No. 511 series of 2013 (confirmed from RITM website).

### 1.4 OpenDengue Philippines Dataset

- **URL:** https://opendengue.org/ | https://github.com/OpenDengue/master-repo
- **Description:** A global database of dengue case counts. Philippines data is contributed primarily from DOH sources. Version 1.3 covers 2012–2023 at national weekly resolution for the Philippines. Contains case counts by severity and confirmation method. Over 4.4 million dengue cases reported from the Philippines (1924–2023 cumulative).
- **Accessibility:** Fully accessible and open data. Downloadable via website and GitHub. CC BY 4.0 license.
- **Geographic resolution:** National (best) and sub-national where available. For Philippines, primarily national-level weekly.
- **Temporal resolution:** Weekly (2012–2023 confirmed from SentinelPH project documentation).
- **Licensing:** CC BY 4.0 (confirmed from opendengue.org).
- **Verified fact:** Philippines is one of the top 3 contributors by case volume to OpenDengue (Brazil 22M, Vietnam 4.5M, Philippines 4.4M as of v1.2). Source: Clarke et al. 2024, Sci Data.
- **Key limitation (verified):** "National granularity only. Province and city-level breakdown is not available in the OpenDengue V1.3 Philippines dataset at useful temporal resolution" (from SentinelPH README).

---

## 2. DOH / FHSIS / Public Surveillance Datasets

### 2.1 Summary of Philippine Surveillance Architecture

| System | Scope | Granularity | Public? | Notes |
|--------|-------|-------------|---------|-------|
| FHSIS | All notifiable diseases | Barangay → National | No | Backbone of PH surveillance |
| RITM SRU | Lab-confirmed cases at RITM | National/Regional | Partial | PDFs and Google Drive |
| OpenDengue | Dengue only | National weekly | Yes | CC BY 4.0, 2012–2023 |
| DOH Statistics | Aggregate health stats | National | Partial | doh.gov.ph/statistics |
| EWARS (TDR) | Climate-sensitive diseases | Varies by country | No (operational) | Used in Mexico; not yet PH |

### 2.2 Key Surveillance Diseases in the Philippines

Based on verified DOH/FHSIS scope and RITM focus:
- **Dengue** (highest burden, weekly reporting, most open data available)
- **Measles** (periodic outbreaks)
- **Cholera / Acute Watery Diarrhea**
- **Influenza-like illness (ILI)**
- **Leptospirosis** (RITM focus area)
- **Typhoid / Paratyphoid**
- **Malaria** (declining, but still monitored)
- **TB** (high burden)

---

## 3. LGU Health Data

### 3.1 Local Health Offices (LHOs)

- **URL:** No centralized portal; each LGU maintains its own health office data
- **Description:** Philippine Local Government Units (provinces, cities, municipalities) have Local Health Offices that collect barangay-level health data, including disease surveillance reports, vaccination coverage, and health facility utilization. This data feeds into FHSIS.
- **Accessibility:** Extremely fragmented. No centralized LGU health data portal exists (verified — no single search result found for a comprehensive LGU health data portal). Some LGUs publish dashboards (e.g., during COVID-19), but these are inconsistent and temporary.
- **Geographic resolution:** Barangay/municipality.
- **Temporal resolution:** Monthly/quarterly (when published).
- **Licensing:** Government data; no uniform license.
- **Suggestion:** For a pilot, target 2–3 pilot LGUs (e.g., Quezon City, Cebu City) where health informatics capacity may be higher. Coordination with RHUs and LHOs would be required.

### 3.2 Philippine Statistics Authority (PSA)

- **URL:** https://psa.gov.ph/
- **Description:** National statistical office. Publishes demographic, economic, and some health-related statistics (vital statistics, mortality, morbidity).
- **Accessibility:** Partially accessible online. Mortality data by cause of death is available.
- **Geographic resolution:** Regional and provincial (municipal-level for some datasets).
- **Temporal resolution:** Annual (vital statistics), quarterly (some surveys).
- **Licensing:** Government data; freely available.

---

## 4. Philippine News/RSS Sources for Event-Based Surveillance

### 4.1 Verified News Sources with RSS Feeds

| Source | RSS URL | Notes |
|--------|---------|-------|
| GMA News | gmanetwork.com/news | Leading news network; 29M Facebook followers |
| ABS-CBN | abs-cbn.com | Major network; 29.9M Facebook followers |
| Rappler | rappler.com/feed | Digital-native; strong health/science coverage |
| PhilStar | philstar.com | Broadsheet; multiple sections available |
| Inquirer | inquirer.net/fullfeed | Broadsheet; comprehensive coverage |
| SunStar | sunstar.com.ph | Regional coverage across provinces |
| Daily Tribune | tribune.com.ph | Tabloid; available via Apify scraper |
| Philippine News Agency | pna.gov.ph | Government newswire |
| Manila Bulletin | manilabulletin.com.ph | Broadsheet |

### 4.2 Aggregators and APIs

| Service | URL | Notes |
|---------|-----|-------|
| PH News API (Apify) | https://apify.com/nekohaii/philippine-news-scraper | Aggregates PhilStar, Rappler, SunStar, Daily Tribune via RSS. Full-text extraction. Keyword filtering. Actor-based (paid). |
| NewsData.io | https://newsdata.io/ | 100+ Philippine news sources, category filtering (including Health). API access required. |
| MediaStack | https://mediastack.com/sources/philippines-news-api | Country=ph parameter, health category support. API key required. |
| APITube | https://support.apitube.io/ | Disease-entity filtering, event.type=health-crisis, SSE streaming, 30s polling. Has disease entity recognition. |
| World News API | https://worldnewsapi.com/ | 9 PH sources, 34+ articles/day. Historical data since Jan 2022. API key required. |
| NewsAPI.org | https://newsapi.org/s/philippines-health-news-api | Philippines health category endpoint. Free tier limited. |

### 4.3 Government/Official Sources

- **PNA (Philippine News Agency):** https://www.pna.gov.ph/ — Government newswire; official statements, outbreak announcements.
- **DOH:** https://www.doh.gov.ph/ — Press releases, outbreak advisories.
- **DOH Epidemiology Bureau:** Publishes outbreak alerts and weekly surveillance reports.

### 4.4 Key Observations

- **Verified:** Multiple RSS feeds are reliably accessible (GMA, Rappler, PhilStar, PNA confirmed).
- **Suggestion:** For event-based surveillance, combine GDELT (global, includes PH news) with a PH-specific RSS aggregator. APITube's disease-entity extraction and health-crisis event classification is particularly well-suited.
- **Suggestion:** PNA and DOH press releases should be treated as ground-truth official signals; commercial news as supplementary early-warning.

---

## 5. Geographic Datasets (Municipalities/Barangays)

### 5.1 Philippine Standard Geographic Code (PSGC)

- **URL:** https://psa.gov.ph/pcg/psgc/
- **Description:** The official classification and coding system for all Philippine provinces, cities, municipalities, and barangays. Maintained by PSA.
- **Accessibility:** Browsable online; downloadable data available from PSA. Barangay-level codes and boundaries.
- **Geographic resolution:** Barangay (42,000+ units).
- **Temporal resolution:** Updated when LGU boundaries change (irregular).
- **Licensing:** Government data; freely accessible.
- **Verified fact:** PSGC is maintained by PSA and is the official geographic coding system for the Philippines.

### 5.2 GADM (Global Administrative Areas)

- **URL:** https://gadm.org/
- **Description:** Global database of administrative areas. Version 4.1 includes Philippines provinces (81 polygons).
- **Accessibility:** Freely downloadable (CC BY 4.0). Available as shapefiles, GeoJSON, R packages.
- **Geographic resolution:** Province level for Philippines (as of GADM 4.1 — verified from SentinelPH README which uses "GADM 4.1, 81 province polygons").
- **Licensing:** CC BY 4.0.
- **Limitation (verified):** GADM for Philippines is at province level (81 provinces), NOT at municipality or barangay level. This is a significant limitation for granular spatial modeling.

### 5.3 OpenStreetMap (OSM)

- **URL:** https://www.openstreetmap.org/
- **Description:** Community-mapped geographic data. Includes Philippine barangay boundaries, roads, buildings.
- **Accessibility:** Freely accessible via Overpass API, Geofabrik downloads.
- **Geographic resolution:** Barangay and below (where mapped). Coverage varies by area.
- **Suggestion:** OSM is likely the best free source for Philippine barangay-level boundaries. Can be queried via Overpass API or downloaded as Philippines extract from Geofabrik.

### 5.4 Natural Earth

- **URL:** https://www.naturalearthdata.com/
- **Description:** Global raster/vector geographic dataset. Used by OpenDengue for geomatching.
- **Accessibility:** Free, public domain.
- **Geographic resolution:** Country/province level only. Not suitable for Philippine sub-national modeling.

### 5.5 Google Administrative Boundaries (GADM via R)

- **URL:** https://cran.r-project.org/web/packages/gadm/index.html
- **Description:** R package providing easy access to GADM data.
- **Accessibility:** Free; CRAN package.

---

## 6. Historical Disease Data for Backtesting

### 6.1 OpenDengue (Primary Source)

- **URL:** https://opendengue.org/ | https://doi.org/10.1038/s41597-024-03120-7
- **Coverage:** Philippines, 2012–2023, national weekly. 4.4M+ cases from PH (1924–2023 cumulative across all years).
- **Format:** CSV via Figshare and GitHub. Three extracts: National, Temporal (highest res), Spatial (highest res).
- **Verified:** v1.3 is latest. 99.8% of records at weekly/monthly resolution globally.
- **Suggestion:** This is the best freely available historical disease dataset for Philippine backtesting.

### 6.2 RITM Surveillance Reports

- **URL:** https://ritm.gov.ph/data/surveillance/ and https://ritm.gov.ph/data/infectious-disease-incidence-data/
- **Coverage:** Various infectious diseases; periodic reports.
- **Format:** PDF fact sheets, media monitoring reports. Not machine-readable without extraction.
- **Suggestion:** Useful for cross-validation but requires manual digitization.

### 6.3 WHO/PAHO Databases

- **URL:** https://www.paho.org/ | https://www.who.int/
- **Description:** PAHO PLISA system contains Latin American dengue data. WHO Global Health Observatory has Philippine health indicators.
- **Coverage:** Not comprehensive for Philippines; better for regional comparisons.

### 6.4 Climate Data (as supplementary variable)

- **Open-Meteo ERA5:** Used by SentinelPH for 18 Philippine regions, daily, 2012–2023. Freely accessible.
- **URL:** https://open-meteo.com/

### 6.5 Google Trends

- **URL:** Via pytrends Python library
- **Description:** Search interest data for disease-related queries in the Philippines. Weekly granularity.
- **Accessibility:** Free via API (rate-limited). Used by SentinelPH.
- **Suggestion:** Useful as a leading indicator/signal but not primary case data.

---

## 7. Existing Public-Health Intelligence Systems

### 7.1 SentinelPH (Philippines — Dengue)

- **URL:** https://github.com/aces-14/sentinel-ph | https://sentinel-ph.streamlit.app/
- **Description:** Multi-agent dengue intelligence platform for the Philippines. Ingests 12 years of surveillance data (OpenDengue), weather (ERA5), news (GDELT), Google Trends. Runs XGBoost risk model, generates AI situation briefings via LangGraph, RAG chat interface.
- **Status:** Live demo. Historical data through 2023. National granularity only.
- **ML:** XGBoost beats ARIMA baseline by ~40% on test RMSE (0.70 vs 1.07 log-scale).
- **Limitations (verified):** National-level only, not real-time, risk scores are not diagnoses.
- **Differentiation opportunity:** SIGMA can extend to sub-national (barangay/municipal) granularity, broader disease coverage, real-time feeds, and spatiotemporal spatial propagation modeling.

### 7.2 DART Dengue (Vietnam)

- **URL:** https://www.dartdengue.org/
- **Description:** Dengue Advanced Readiness Tools by Oxford University Clinical Research Unit (OUCRU), Wellcome Trust. District-level forecasts 1–12 weeks ahead for Ho Chi Minh City. Combines ML with uncertainty intervals.
- **Status:** Operational in Vietnam. Being adapted for other countries.
- **Differentiation:** DART is district-level for Vietnam; SIGMA targets barangay/municipal level for Philippines with broader disease scope.

### 7.3 Infodengue (Brazil)

- **URL:** https://info.dengue.mat.br/
- **Description:** Early-warning system for arboviruses (dengue, chikungunya, zika) operating in all Brazilian municipalities. Bayesian inference-based statistical method (Bastos et al. 2019). R AlertTools package. Weekly alerts with color-coded classification system.
- **Status:** Operational nationwide in Brazil since 2015 (national coverage since 2021).
- **Key methods:** Nowcasting with delay estimation, Moving Epidemics method, Bayesian spatiotemporal hierarchical models.
- **Differentiation:** Infodengue is municipal-level for Brazil; SIGMA could use similar methodology for Philippine municipalities/barangays.

### 7.4 DIRE Platform (Brazil/Peru)

- **URL:** https://sdgpolicyinitiative.org/the-dire-platform-predicting-outbreaks-preparing-responses/
- **Description:** Disease Incidence and Resource Estimator. Ensemble ML for 2-month dengue/malaria projections. Calculates resource requirements. Developed by UCSD SDG Policy Initiative, validated in Scientific Reports (2024).
- **Status:** Operational in Brazil and Peru.
- **Differentiation:** DIRE's resource estimation feature and ensemble ML approach could inform SIGMA's design.

### 7.5 Flyttr Dengue (Brazil)

- **URL:** https://ai.flyttr.com/dengue/explore/
- **Description:** City-wide dengue risk forecasting for 5,000+ Brazilian cities, up to 8 weeks ahead. Combines macro-level epidemiological forecasting with high-resolution satellite/neighborhood-level mosquito breeding suitability mapping. AI assistant.
- **Status:** Operational.
- **Differentiation:** Flyttr's building/neighborhood-level vector suitability modeling is highly advanced; SIGMA could integrate similar remote sensing data for Philippine contexts.

### 7.6 E4Warning (Europe)

- **URL:** https://www.e4warning.eu/
- **Description:** Eco-Epidemiological Intelligence for Early Warning response to Mosquito-borne disease risk. HORIZON Europe project. Combines citizen science, AI, Earth Observation, mosquito surveillance. D-MOSS forecasting provides 1–6 month dengue forecasts, adopted in Sri Lanka and Malaysia.
- **Status:** Research/operational transition.
- **Differentiation:** D-MOSS forecasting method (1–6 months) is relevant for SIGMA's temporal horizons.

### 7.7 EWARS / EWARS-csd (WHO/TDR)

- **URL:** https://tdr.who.int/activities/ewars-csd
- **Description:** Early Warning and Response System for climate-sensitive diseases (dengue, cholera, malaria, etc.). Designed by TDR and University of Gothenburg. Predicts outbreaks ~12 weeks in advance. Operational in Mexico (first country integrated into national surveillance). Pilots in Ethiopia, Burkina Faso, Colombia, etc.
- **Status:** Operational in Mexico; pilots in multiple countries. Not yet in Philippines.
- **Key method:** Dashboard 1 (country/central level) = retrospective alarm analysis. Dashboard 2 (district level) = prospective weekly alarm with meteorological/epidemiological data.
- **Differentiation:** EWARS is the WHO standard; SIGMA could position as an EWARS-adapted system for the Philippines, filling the gap where EWARS has not been adopted.

### 7.8 Arbothai (Thailand)

- **URL:** https://arbothai.org/
- **Description:** Dengue early detection and response platform by ISGlobal. Province and subdistrict level (Bangkok).
- **Differentiation:** Similar scope but Thailand-specific; relevant methodology.

---

## 8. Academic Methods

### 8.1 Event-Based Surveillance (EBS)

**Definition:** Detection of disease outbreaks based on detection of events (news reports, social media, official declarations) rather than waiting for cases to be reported through routine surveillance.

**Key References/Methods:**
- **GDELT Project:** Global database of events, including health-related events. Used by SentinelPH for Philippine dengue news monitoring.
  - **URL:** https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
  - **Accessibility:** Free API and bulk data. Doc 2.0 API.
  - **Suggestion:** Use GDELT as global news signal backbone; supplement with PH-specific RSS sources for local detail.
- **ProMED-mail:** International reporting system for outbreak information. Used as source in OpenDengue.
  - **URL:** https://www.promedmail.org/
  - **Accessibility:** Free, public archive.

### 8.2 Anomaly Detection

**Methods suitable for disease surveillance:**

| Method | Description | Reference/Tool |
|--------|-------------|----------------|
| **Farrington algorithm** | Baseline deviation algorithm for count data; computes expected counts and flags excess. CDC ArboNET uses it. | Farrington et al. 1996; R `surveillance` package |
| **EARS (Early Aberration Reporting System)** | C3, C4, C5 algorithms for sequential anomaly detection in count data. | CDC, IYASP |
| **R AlertTools** | Implements EWARS, Moving Epidemics, nowcasting methods for arboviruses. | Bastos et al. 2019; R package |
| **EpiNow2** | R package for real-time monitoring of surveillance data; nowcasting with reporting delay distributions. | R package |
| **Scan statistics (spatial/temporal)** | Kulldorff spatial scan statistic; detects clusters of disease. | Kulldorff 1997; R `satscan` package |
| **Prophet (Facebook/Meta)** | Time series decomposition with trend, seasonality, holidays; anomaly flagging. | Taylor & Letham 2018 |
| **Isolation Forest / Autoencoders** | Unsupervised ML anomaly detection on multivariate surveillance data. | Various |

**Suggestion:** For the Philippines MVP, Farrington/EARS algorithms (via R `surveillance` package) should be the baseline anomaly detection layer, supplemented by ML-based approaches for richer signal detection.

### 8.3 Spatial-Temporal Disease Modeling

| Method | Description | Reference |
|--------|-------------|-----------|
| **Bayesian spatiotemporal hierarchical models** | Model disease counts with spatial autocorrelation (BYM/ICAR) and temporal autocorrelation. Gold standard for disease mapping. | Lawson et al.; Banerjee et al. "Hierarchical Modeling and Analysis for Spatial Data" |
| **SEIR/SIR compartmental models** | Epidemiological ODE models with spatial diffusion (reaction-diffusion PDEs). | Kermack-McKendrick; Lipsitch et al. |
| **Gravity models** | Disease spread proportional to population mass and inversely proportional to distance. Used for dengue importation. | Pigott et al. 2012 |
| **Diffusion models** | Reaction-diffusion PDEs; spatial propagation of infection. | Murray "Mathematical Biology" |
| **Network/commuting models** | Human mobility (commuting, air travel) as spatial connectivity. | |
| **Spatiotemporal Bayesian regression (INLA)** | Integrated Nested Laplace Approximation for fast Bayesian inference. | INLA; R-INLA package |
| **Gaussian Process (GP) spatiotemporal** | Non-parametric Bayesian spatial modeling. | |

**Suggestion:** Bayesian spatiotemporal hierarchical models (BYM/ICAR + temporal AR) implemented via INLA or Stan should be the primary spatial modeling framework. This aligns with Infodengue's approach and is well-suited for the Philippines' 17 regions and thousands of barangays.

### 8.4 Epidemic Intelligence & Signal Detection

- **WHO Epidemic Intelligence from Open Sources (EIOS):** Automated collection and analysis of open-source data for epidemic intelligence. Uses GDELT, ProMED, news sources.
  - **URL:** https://www.who.int/publications/i/item/9789240030607
  - **Suggestion:** EIOS methodology is the WHO standard; SIGMA can implement a PH-specific version.

### 8.5 Diffusion / Spatial Propagation Models

| Model | Application | Reference |
|-------|-------------|-----------|
| **Reaction-diffusion PDE** | Continuous spatial spread of infection | Murray "Mathematical Biology" Vol II |
| **Agent-based models (ABM)** | Individual-level simulation of movement and infection | Granell et al. 2013 |
| **Metapopulation models** | Population centers connected by mobility; SIR within, diffusion between | Ball & Fotheringham 1995 |
| **Gravity model extensions** | Importation risk from commuting/air travel | Pigott et al. 2012 |
| **D-MOSS** | Forecasting 1–6 months; used in Sri Lanka/Malaysia | E4Warning project |

**Suggestion:** A metapopulation framework connecting Philippine LGUs by commute/air-travel data is the most practical diffusion model for the MVP, as it can leverage existing connectivity data and be calibrated with dengue transmission data.

---

## 9. Recommendations

### A. Recommended MVP Dataset

**Primary dataset:** OpenDengue V1.3 Philippines data (2012–2023, national weekly).

- **Why:** Fully accessible, CC BY 4.0 license, machine-readable CSV, 11+ years of historical data, geomapped to standard codes, well-documented, peer-reviewed.
- **Supplementary:**
  - Open-Meteo ERA5 weather data for 18 Philippine regions (temperature, rainfall, humidity — key dengue drivers)
  - GDELT news data for the Philippines (health-related events)
  - Google Trends data for Philippines (search interest in dengue/health terms)
  - GADM 4.1 Philippines province boundaries (81 polygons)
  - PSGC barangay/municipality codes from PSA (for geographic reference)
  - OSM barangay boundaries (from OpenStreetMap — for spatial modeling at finer granularity)
  - RITM surveillance PDF reports (for validation and supplementary disease data)

**MVP scope:** Weekly dengue case counts at national level (expanding to regional in Phase 2), with weather, news, and search trend signals as covariates.

### B. Recommended Disease/Use-Case

**Primary: Dengue forecasting and risk monitoring.**

- **Why:**
  - Dengue is the #1 priority disease in the Philippines (WHO-listed; 4.4M cases in OpenDengue; highest burden among vaccine-preventable diseases)
  - Best available historical data (OpenDengue)
  - Strong climate sensitivity (temperature, rainfall, humidity — all available via ERA5)
  - Existing literature and models to build upon (SentinelPH, DART, Infodengue, DIRE, Flyttr)
  - Seasonal patterns are well-characterized (peak during rainy season, June–November)
  - DOH actively monitors and reports dengue weekly
- **Secondary (Phase 2):** Expand to measles, influenza-like illness, cholera.

### C. Recommended ML/Statistical Methodology

**Two-layer approach:**

**Layer 1 — Statistical baseline (anomaly detection & forecasting):**
- Farrington algorithm or EARS C3/C5 for anomaly detection (weekly case counts vs. baseline)
- Seasonal ARIMA (SARIMA) or Holt-Winters for forecasting
- These are well-understood, interpretable, and form the WHO-recommended baseline (EWARS uses similar methods)

**Layer 2 — Machine learning (prediction & risk scoring):**
- XGBoost/LightGBM gradient-boosted trees for weekly case forecasting (as validated by SentinelPH: beats ARIMA by ~40% on test RMSE)
- Features: case lags (1/2/4/8 weeks), 4-week rolling means, weather lags, Google Trends signal, news count, epiweek, month, rainy-season flag
- Bayesian spatiotemporal hierarchical model for spatial risk estimation (BYM/ICAR for spatial + AR for temporal, via INLA or Stan)

**Layer 3 — Event-based surveillance (signal detection):**
- NLP pipeline on PH news sources (GDELT + PH RSS aggregator) for health crisis event detection
- Keyword/disease-entity extraction for early warning signals before case data reflects outbreaks

### D. Recommended Spatial Model

**Hierarchical Bayesian spatiotemporal model with barangay/provincial aggregation:**

**Primary framework:** Bayesian hierarchical model with:
- **Spatial component:** Intrinsic Conditional Autoregressive (ICAR) prior capturing spatial autocorrelation between adjacent administrative units (provinces → municipalities → barangays)
- **Temporal component:** Autoregressive (AR) structure for temporal correlation
- **Covariates:** Climate (temperature, rainfall, humidity), population density, urbanization index, water body proximity
- **Implementation:** R-INLA for computational efficiency, or Stan/PyMC for flexibility

**Spatial hierarchy (MVP → Phase 2):**
- MVP: Provincial level (81 provinces, matching GADM coverage)
- Phase 2: Municipal level (1,488 municipalities, obtainable from PSA/OSM)
- Phase 3: Barangay level (42,000+ barangays, from PSA/OSM)

**Diffusion component:** Metapopulation model connecting LGUs by commuting patterns (from PSA census data on workplace-place-of-residence) and air travel (from airline data). This enables forecasting spatial propagation between regions.

### E. Validation/Backtesting Methodology

**Temporal split (following SentinelPH):**
- Training: 2012–2020
- Validation: 2021
- Test: 2022–2023

**Backtesting protocol:**
1. **Rolling origin evaluation:** Train on data up to time t, forecast 1–4 weeks ahead, slide forward by 1 week. Compute metrics across all rolling windows.
2. **Seasonal validation:** Test on both high-season (June–November) and low-season (December–May) periods to verify model handles both regimes.
3. **Cross-validation:** Block cross-validation preserving temporal ordering (to prevent data leakage).

**Metrics:**
- **Forecasting:** RMSE, MAE, WIS (Weighted Interval Score for probabilistic forecasts), coverage probability of prediction intervals
- **Anomaly detection:** Sensitivity (true positive rate), specificity, false alarm rate, alert time (how many weeks before peak)
- **Spatial:** Moran's I on residuals (check spatial autocorrelation is captured), spatial AUC (cluster detection accuracy)

**Benchmark comparisons:**
- Naïve (last value)
- Seasonal ARIMA / SARIMA
- Farrington/EARS (for anomaly detection)
- SentinelPH XGBoost (as comparison)

### F. Data-Source Acquisition Plan

| Phase | Timeframe | Actions | Data Sources |
|-------|-----------|---------|-------------|
| **Phase 0** | Week 1–2 | Set up data infrastructure; download OpenDengue, ERA5, GDELT | OpenDengue, Open-Meteo, GDELT |
| **Phase 0** | Week 2–4 | Acquire Philippine geographic boundaries | PSA PSGC, OSM barangay data, GADM |
| **Phase 1** | Week 4–8 | Build ingestion pipeline; establish weekly data refresh | OpenDengue API/CSV, ERA5 API, GDELT API |
| **Phase 1** | Week 6–10 | Set up Philippine news RSS pipeline | Apify PH News, GDELT, PNA RSS |
| **Phase 2** | Month 3 | Request FHSIS data from DOH/RHU | DOH Epidemiology Bureau, RHU |
| **Phase 2** | Month 3–4 | Negotiate access to LGU health data | Targeted LGU health offices |
| **Phase 2** | Month 4 | Acquire PSA demographic data for covariates | PSA census data |
| **Phase 3** | Month 5+ | Pilot sub-national modeling | RITM data, regional FHSIS data |

**Critical path item:** DOH/FHSIS data access. This is the largest unknown. Begin engagement with DOH Epidemiology Bureau and NCDPC immediately.

### G. Risks and Limitations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **FHSIS data not accessible** | High | Start with OpenDengue as primary data source; pursue formal MOU with DOH in parallel |
| **No real-time data in MVP** | Medium | OpenDengue data lags; GDELT/news signals provide partial real-time proxy |
| **National-only granularity in primary dataset** | Medium | Phase 1 stays national; Phase 2 targets regional/provincial via RITM and PSA data |
| **Data quality / underreporting** | High | Document known limitations; use surveillance-adjusted counts; cross-validate with RITM lab data |
| **Model overfitting on seasonal patterns** | Medium | Strict temporal validation; regularization; ensure out-of-season testing |
| **Geographic boundary changes** | Low | PSA PSGC is authoritative; track versioned boundary changes |
| **Computational cost of Bayesian spatial models** | Medium | Use INLA for fast approximation; GPU acceleration if using Stan |
| **News data noise / false signals** | Medium | Multi-source corroboration requirement; confidence scoring for news signals |
| **WHO EWARS already covers similar methods** | Low | Position SIGMA as complementary (sub-national, multi-disease, AI-enhanced) rather than competing |
| **LGU data privacy concerns** | Medium | De-identification protocols; work through DOH/RHU channels; comply with Data Privacy Act of 2012 |

### H. Existing Similar Projects to Differentiate From

| Project | Scope | Granularity | Key Differentiation for SIGMA |
|---------|-------|-------------|------------------------------|
| **SentinelPH** | Dengue only, PH | National weekly | **Multi-disease, sub-national, real-time, spatial diffusion** |
| **DART (Vietnam)** | Dengue, Vietnam | District, 1–12 week forecast | **PH context, broader diseases, barangay-level, multi-source signals** |
| **Infodengue (Brazil)** | Arboviruses, Brazil | Municipal | **PH context, EWARS integration, richer spatiotemporal model** |
| **DIRE (Brazil/Peru)** | Dengue/malaria, Brazil/Peru | Multi-level | **PH focus, resource estimation, event-based surveillance** |
| **Flyttr (Brazil)** | Dengue, Brazil | Neighborhood/building | **PH context, broader scope, government system integration** |
| **E4Warning (Europe)** | Mosquito-borne, Europe | Varies | **PH tropical context, FHSIS integration, different disease ecology** |
| **EWARS (WHO/TDR)** | Climate-sensitive diseases, Mexico | District | **PH adoption (not yet implemented), open-source implementation** |
| **Arbothai (Thailand)** | Dengue, Thailand | Province/subdistrict | **PH context, multi-disease, FHSIS integration** |

**SIGMA positioning:** First comprehensive public-health intelligence platform for the Philippines combining (1) multi-disease surveillance, (2) sub-national (barangay/municipal) spatial modeling, (3) event-based news surveillance, (4) spatiotemporal diffusion modeling, and (5) integration with PH government systems (FHSIS, DOH, RITM).

---

## Appendix: Key URLs Reference

### Philippine Government Sources
- DOH: https://www.doh.gov.ph/
- DOH Statistics: https://doh.gov.ph/statistics
- RITM Surveillance: https://ritm.gov.ph/data/surveillance/
- RITM Infectious Disease Data: https://ritm.gov.ph/data/infectious-disease-incidence-data/
- PSA (PSGC): https://psa.gov.ph/pcgs/pcgc/
- PNA: https://www.pna.gov.ph/

### Open Data / Global Platforms
- OpenDengue: https://opendengue.org/ | GitHub: https://github.com/OpenDengue/master-repo | DOI: https://doi.org/10.1038/s41597-024-03120-7 | Figshare: https://doi.org/10.6084/m9.figshare.24259573
- Open-Meteo ERA5: https://open-meteo.com/
- GDELT: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
- GADM: https://gadm.org/
- Natural Earth: https://www.naturalearthdata.com/

### Philippine News Aggregators
- PH News API (Apify): https://apify.com/nekohaii/philippine-news-scraper
- NewsData.io: https://newsdata.io/
- MediaStack: https://mediastack.com/sources/philippines-news-api
- APITube: https://support.apitube.io/
- World News API: https://worldnewsapi.com/
- RSS Feedspot PH: https://rss.feedspot.com/philippines_news_rss_feeds/

### Similar Systems
- SentinelPH: https://github.com/aces-14/sentinel-ph | Demo: https://sentinel-ph.streamlit.app/
- DART Dengue: https://www.dartdengue.org/
- Infodengue: https://info.dengue.mat.br/
- DIRE: https://sdgpolicyinitiative.org/the-dire-platform-predicting-outbreaks-preparing-responses/
- Flyttr: https://ai.flyttr.com/dengue/explore/
- E4Warning: https://www.e4warning.eu/
- EWARS (WHO/TDR): https://tdr.who.int/activities/ewars-csd
- Arbothai: https://arbothai.org/

### Method Reference Papers
- Clarke J et al. (2024). "A global dataset of publicly available dengue case count data." Sci Data 11, 296. https://doi.org/10.1038/s41597-024-03120-7
- Bastos LS et al. (2019). "Nowcasting and forecasting dengue in Brazil using a statistical method." PLOS Computational Biology. (R AlertTools)
- Kulldorff M (1997). "A spatial scan statistic." Communications in Statistics.
- Lawson AB et al. "Hierarchical Modeling and Analysis for Spatial Data."
- Murray JD "Mathematical Biology." Vol II: Spatial Models and Biomedical Applications.

---

## Legend

- **[Verified]** — Confirmed via web research, website visits, or project documentation
- **[Suggested]** — Recommendation based on domain expertise and analogous systems; not yet verified for this specific implementation
- **[Assumed]** — Plausible but unverified; requires further investigation before implementation
