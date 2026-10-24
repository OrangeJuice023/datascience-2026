<div align="center">

<img src="web/public/mascot/sigi/greeting.gif" width="104" alt="Sigi, SIGMA's pixel-art bird mascot, waving">

# SIGMA

**Spatial Intelligence & Geographic Modeling for Action**

Dengue early-warning for the Philippines, looked at in hindsight:<br>
126 reporting units, two warning signals, and an assistant that cites its sources.

[![Validate](https://github.com/OrangeJuice023/datascience-2026/actions/workflows/validate.yml/badge.svg)](https://github.com/OrangeJuice023/datascience-2026/actions/workflows/validate.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-111111?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-mobile-1B1F23?style=flat-square&logo=expo&logoColor=white)
![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![PJDSC 2026](https://img.shields.io/badge/PJDSC-2026-E8590C?style=flat-square)

[**Open the live site**](https://datascience-2026.vercel.app) &nbsp;·&nbsp;
[API reference](https://datascience-2026.vercel.app/documentation) &nbsp;·&nbsp;
[Docs](docs/architecture.md) &nbsp;·&nbsp;
[Status and next steps](docs/next-steps.md)

</div>

<br>

> [!IMPORTANT]
> **Hackathon prototype.** SIGMA works on historical data (2016-2021). It is not real-time
> surveillance, it does not predict outbreaks or issue alerts, it never prescribes policy,
> and nothing in it is a validated public-health claim.

<br>

<div align="center">

| **126** | **261** | **15,586** | **17** |
| :---: | :---: | :---: | :---: |
| DOH reporting units | weeks of unit-level data | health facilities mapped | sourced policy records |
| <sub>59 provinces, 22 province remainders, 44 cities, Pateros</sub> | <sub>10 Jan 2016 to 3 Jan 2021</sub> | <sub>OpenStreetMap snapshot, 13 Oct 2026</sub> | <sub>local records for 4 cities, plus national law</sub> |

</div>

## The app

The mobile app can be accessed [here](https://drive.google.com/drive/folders/1COQuwj0S7cpUBmg8tq7f_EX0541tNH5v). 
Three tabs, all on real data. Where a figure has no public source (medicine stock,
search demand, population per unit), SIGMA says "unknown" instead of guessing.

| | Tab | What you can do there |
| :---: | --- | --- |
| 🏠 | **Overview** &nbsp;`/` | See what SIGMA covers, how the two signals work, and where to go next. |
| 🗺️ | **Explore** &nbsp;`/explore` | Map every reporting unit week by week: reported cases, EARS signal, DOH threshold, and weekly weather for 12 cities. |
| 🔬 | **Analyze** &nbsp;`/analyze` | Three views on one place at a time, listed below. |

**Inside Analyze**

- **ACCESS** &nbsp;`/analyze/access`: hospitals, clinics, pharmacies and labs mapped in each
  reporting unit, and what DOH hospitals paid for dengue medicines (DPRI 2026).
- **Policy, with SIGI** &nbsp;`/analyze/policy`: ask about any reporting unit. SIGI answers
  only from that unit's evidence (Lab results, ACCESS figures, local and national policy),
  numbers every source, and the server rejects any citation from another place.
- **Lab** &nbsp;`/analyze/lab`: the national trend, each unit's weekly EARS and DOH marks,
  which signal came first each year, and how the methods work.

Also: **Data Sources** (`/data-sources`) lists every dataset with its coverage, licence and
credit line, and **Documentation** (`/documentation`) renders the API reference.

### Mobile view

The Expo app on an Android emulator (Pixel 7, Android 15), on real data from the API. It
finds the API by itself: here, the web server on the development machine. Screenshots are
in [docs/mobile-view/](docs/mobile-view/).

| Overview | Overview, charts | Explore, map |
| :---: | :---: | :---: |
| <img src="docs/mobile-view/01-overview.png" width="240" alt="Overview: SIGMA wordmark, year and place filters, four stat tiles for 2016-2021"> | <img src="docs/mobile-view/02-overview-charts.png" width="240" alt="Overview: national weekly cases chart, cases by reporting unit, recent EARS signals donut"> | <img src="docs/mobile-view/03-explore-map.png" width="240" alt="Explore map: EARS alarm weeks per year for the 126 reporting units, 2016-2020"> |
| **Explore, 2019** | **Explore, one unit** | **Explore, trends** |
| <img src="docs/mobile-view/04-explore-map-2019.png" width="240" alt="Explore map for 2019: most units over 12 alarm weeks"> | <img src="docs/mobile-view/05-explore-unit.png" width="240" alt="Explore: a selected unit and its EARS alarm weeks"> | <img src="docs/mobile-view/06-explore-trends.png" width="240" alt="Explore trends: a unit's cases, EARS and DOH weeks by epi year"> |
| **Analyze** | **About these numbers** | **Settings** |
| <img src="docs/mobile-view/07-analyze.png" width="240" alt="Analyze ACCESS: mapped facilities for a reporting unit"> | <img src="docs/mobile-view/08-about.png" width="240" alt="About these numbers: sources and caveats"> | <img src="docs/mobile-view/09-settings.png" width="240" alt="Settings: the API address, found automatically"> |

On the maps, colour is a signal category and dot size is a count. Areas are never filled by
case counts, and a unit with no computable result is drawn hollow.

## How it works

```mermaid
flowchart LR
  subgraph Sources
    HDX["HDX DOH dengue<br/>126 units, 2016-2021"]
    OD["OpenDengue<br/>national weekly"]
    OSM["OpenStreetMap<br/>health facilities"]
    DPRI["DOH DPRI<br/>medicine prices"]
    POL["Policy documents<br/>local and national"]
    WX["CCHAIN and Open-Meteo<br/>weather"]
  end

  HDX --> ML["Python pipeline<br/>clean, EARS, DOH thresholds"]
  ML --> EXP[("Committed export<br/>hdx-dengue-sigma.json")]
  OSM --> ACC["scripts/access<br/>pinned build"]
  DPRI --> ACC

  EXP --> WEB["Next.js app<br/>and /api/v1"]
  OD --> WEB
  ACC --> WEB
  WX --> WEB
  POL --> WEB

  WEB --> UI["Overview, Explore, Analyze"]
  WEB --> SIGI["SIGI<br/>evidence pack per unit"]
  WEB --> MOB["Expo mobile app"]
```

### Two signals, read together

| Signal | Asks | Rule | Good at |
| --- | --- | --- | --- |
| **EARS** C1, C2, C3 | Is this week a sudden rise? | Compares a week with the 7 weeks before it (CDC EARS) | Timing: it fires early, but at every season's start |
| **DOH threshold** | Is this level high for the season? | Same week's mean over 3 prior years, + 1 SD for alert, + 2 SD for epidemic (PIDSR manual s. 5.3.5) | Size: it separates a big season from an ordinary one |

In the 2019 epidemic, EARS alarmed nationally on 26 May 2019, seven weeks before the DOH
national alert. That is why SIGMA always shows both. See the
[EARS QA report](docs/reports/dengue_ears_qa_report.pdf).

## Data

| Source | Licence | Coverage | Used in |
| --- | --- | --- | --- |
| [HDX Philippine Dengue Cases and Deaths](https://data.humdata.org/dataset/philippine-dengue-cases-and-deaths) (DOH Epidemiology Bureau data, via Cirrolytix) | CC BY | 126 reporting units, weekly, 2016-2021 | Explore, Lab, SIGI |
| [OpenDengue v1.3](https://opendengue.org) | CC BY 4.0 | National, weekly, Dec 2012 to Nov 2023 (544 weeks, with gaps) | Lab, `/dengue/summary`, `/dengue/observations` |
| [HOT OpenStreetMap health facilities](https://data.humdata.org/dataset/hotosm_phl_health_facilities) | ODbL 1.0 | 15,586 facilities after cleaning, snapshot 2026-10-13 | ACCESS, SIGI |
| [DOH Drug Price Reference Index](https://dpri.doh.gov.ph/drug_search) 2026 | Philippine government work | Public-hospital prices for 4 dengue medicines (procurement year 2025) | ACCESS, SIGI |
| Policy evidence registry | Per document | 17 records, each tied to its source document | SIGI |
| [Project CCHAIN](https://data.humdata.org/dataset/project-cchain) climate | CC BY 4.0 | 12 cities, weekly, 2003-2022 | Explore → Environment |
| [Open-Meteo](https://open-meteo.com/) historical weather (ERA5) | CC BY 4.0 | Same 12 cities, weekly, 2008 to Oct 2026 | Explore → Environment |
| OCHA COD-AB, geoBoundaries, PSA PSGC | CC BY-IGO, CC BY 3.0 IGO, PSA terms | Region down to reporting unit | Boundaries and codes |

**Not available, so shown as unknown:** medicine stock per facility, what people search for,
and population per reporting unit.

<details>
<summary><b>Known data-quality limits</b></summary>

<br>

Detail in [docs/dengue-pipeline.md](docs/dengue-pipeline.md) and [docs/geo/](docs/geo/README.md).

- Reporting units are not provinces: 22 are province remainders. Values are only summed
  upward, never split.
- Missing weeks (for example 6 Jan 2019, for every unit) and 665 suspected cases↔deaths swap
  rows are **no data**, never zero.
- The meaning of the HDX `date` column, whether counts are by residence, and whether province
  rows exclude their cities are **unconfirmed** assumptions.
- Zeros cannot be told apart from "no report". Long zero runs and one-week spikes are flagged,
  not corrected. The national OpenDengue series has year-end reporting artefacts.
- The DOH thresholds use 3 prior years, the shortest the PIDSR manual allows. The official
  system may use 5 years and regional thresholds.
- A low facility count can mean low OpenStreetMap mapping, not low access.

</details>

## Getting started

You need Node.js 20+ and npm. The data pipeline also needs Python 3.12.

```bash
# Web app and API: http://localhost:3000
cd web && npm ci && npm run dev

# Mobile app (finds the API by itself: your dev machine, the emulator host, then the deployed API)
cd mobile && npm ci && npm start

# MCP server: SIGMA's API as tools for Claude and other MCP clients (see mcp/README.md)
cd mcp && npm ci && npm start

# Python pipeline (needs the raw files in data/raw/, see docs/dengue-pipeline.md)
pip install -r ml/requirements.txt
python ml/clean_dengue.py && python ml/ears.py
```

<details>
<summary><b>Environment variables</b> (all optional)</summary>

<br>

Copy each `.env.example` and fill in what you need. Never commit the real file.

| File | Variables | When unset |
| --- | --- | --- |
| [`web/.env.example`](web/.env.example) → `web/.env.local` | `GROQ_API_KEY` (server only), `GROQ_MODEL`, `CHAT_DISABLED`, `CHAT_PUBLIC_DISABLED` | SIGI answers `not_configured` |
| | `NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_STYLE` | Maps use OpenStreetMap raster tiles |
| [`mobile/.env.example`](mobile/.env.example) → `mobile/.env` | `EXPO_PUBLIC_API_BASE_URL` (bundled into the app, never a secret) | Found automatically ([docs/mobile.md](docs/mobile.md#pointing-the-app-at-the-api)) |
| (shell) | `SIGMA_API_BASE_URL`, for the MCP server | The deployed API |
| [`ml/.env.example`](ml/.env.example) → `ml/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | Unused today (no database yet) |

</details>

<details>
<summary><b>Repository layout</b></summary>

<br>

```
web/                       Next.js 16 (App Router), TypeScript, Tailwind; MapLibre, deck.gl, Recharts
  src/app/api/v1/          The versioned JSON API
  src/lib/api/             API services and the endpoint registry (feeds /api/v1 and /documentation)
  src/lib/analyze-chat/    SIGI: evidence pack, prompt, playbook
mobile/                    Expo + React Native client of the API
mcp/                       MCP server: the read-only API as tools for AI clients
packages/sigma-contracts/  Request/response types shared by web and mobile
ml/                        Python pipeline: clean_dengue.py → ears.py → export_sigma_web.py
scripts/geo/               Geography build: HDX reporting units → COD-AB / PSA PSGC
scripts/access/            ACCESS build: OpenStreetMap facilities and DOH prices, hash-pinned
data/reference/            Small committed reference tables
data/raw/, data/processed/ Local only, git-ignored
docs/                      Architecture, API, pipeline, geography and data-model docs
```

The web app is both the UI and the API, and the mobile app is a second client. Analysis runs
offline in Python, and its output (`web/public/data/sigma/hdx-dengue-sigma.json`) is a
committed, generated file. There is no database yet. See [docs/architecture.md](docs/architecture.md).

</details>

## API

Read-only JSON at `/api/v1` ([live](https://datascience-2026.vercel.app/api/v1)), no
authentication. Every response is `{ data, meta }` or `{ error, meta }`, and `meta.status`
says what kind of data it carries.

| Endpoint | Returns | `meta.status` |
| --- | --- | --- |
| `GET /api/v1` | Endpoint index | `live` |
| `GET /api/v1/health` | Service status and configuration flags | `live` |
| `GET /api/v1/sources` | Source catalogue | `live` |
| `GET /api/v1/dengue/observations` | National weekly observations (OpenDengue) | `live` |
| `GET /api/v1/dengue/summary` | National weekly, monthly and yearly aggregates | `live` |
| `GET /api/v1/dengue/signals` | EARS C1/C2/C3 results per reporting unit and week (`locationId`, `week`) | `live` (historical) |
| `GET /api/v1/access/units` | Mapped facilities and dengue burden per reporting unit | `live` |
| `GET /api/v1/access/medicines` | DOH medicine prices and formulary status | `live` |
| `GET /api/v1/access/metrics` | Retired; answers with empty lists | `not_connected` |
| `GET /api/v1/policy/info` | Policy evidence summary, SIGI's 126 units and AI disclosure | `live` |
| `GET /api/v1/policy/evidence` | The policy evidence records | `live` |
| `POST /api/v1/chat` | SIGI's answer with server-checked citations | `live`, or `not_configured` without a key |

```bash
curl "https://datascience-2026.vercel.app/api/v1/dengue/observations?limit=2"
curl "https://datascience-2026.vercel.app/api/v1/access/units?unitId=quezon-city"
curl "https://datascience-2026.vercel.app/api/v1/dengue/signals?locationId=iloilo-city&week=2019-07-14"
```

**MCP.** [`mcp/`](mcp/README.md) wraps these endpoints as Model Context Protocol tools
(`dengue_signals`, `dengue_units`, `access_units`, ...) so Claude and other MCP clients can
query SIGMA and see the same `meta.status` / `isSample` provenance.

`live` means real records from a connected source, which may still be historical. Full
reference: [docs/api.md](docs/api.md) and [`/documentation`](https://datascience-2026.vercel.app/documentation).

<details>
<summary><b>Notes for API integrators</b></summary>

<br>

- No endpoint takes credentials, and there are no API keys or quotas. This is a prototype
  deployment, not a hardened public API.
- SIGI's model key stays on the server. `/api/v1/chat` is rate limited (30 requests per 60 s
  per IP) and refuses with `not_configured` when no key is set.
- Branch on `meta.status`. Never treat `not_connected` or a missing week as "nothing found".
- Request limits (row caps, 16 KB body) are in [docs/api.md](docs/api.md#limits).

</details>

## Where things stand

| Part | State |
| --- | --- |
| Dengue cleaning, DOH thresholds, EARS C1-C3 | ✅ Run offline on 2016-2021 data, with QA reports ([docs/reports/](docs/reports/)) |
| EARS and DOH results in the app and API | ✅ Explore, Lab and `/dengue/signals` |
| Spatial analysis of the signals | ✅ Clustering, Knox test, local vs aggregate lead time ([report](docs/geo/spatial-analysis-report.md)) |
| Mobile app | ✅ Overview and Explore dashboards; finds the API automatically ([screens](#mobile-view)) |
| MCP server | ✅ The read-only API as MCP tools ([mcp/](mcp/README.md)) |
| ACCESS | ✅ Real facilities and prices · ⛔ medicine stock has no public source |
| SIGI | ✅ Evidence pack per unit, server-checked citations · 🔜 answer quality to be live-tested with a model key |
| Policy coverage | 🔜 Local records for 4 of 126 units so far |
| Forecasting | ⛔ Not started: no fitted model yet ([research plan](planning/SIGMA_RESEARCH.md)) |

The full checklist, with what blocks each item, is in [docs/next-steps.md](docs/next-steps.md).

## Checks

```bash
cd web    && npm run lint && npm run typecheck && npm run test && npm run build
cd mobile && npm run lint && npm run typecheck && npm run test
cd mcp    && npm test
python -m compileall -q ml && python -m unittest discover -s ml/tests
```

CI ([`validate.yml`](.github/workflows/validate.yml)) runs all of these on every pull request.
The web tests include a registry test that runs every documented API example against the real
handler, so `/documentation` cannot drift from the code.

## Documentation

| Document | Covers |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | System architecture |
| [docs/api.md](docs/api.md) | API endpoints, envelopes, limits and errors |
| [docs/dengue-pipeline.md](docs/dengue-pipeline.md) | Cleaning, DOH thresholds and EARS ([QA reports](docs/reports/)) |
| [docs/geo/](docs/geo/README.md) | Reporting units, geography method and data quality |
| [docs/environmental-covariates.md](docs/environmental-covariates.md) | Weather sources, comparability, covariate plan |
| [docs/access-data-model.md](docs/access-data-model.md) | ACCESS data model and open decisions |
| [docs/mobile.md](docs/mobile.md) | Expo client, API discovery, EAS builds ([screens](docs/mobile-view/)) |
| [mcp/README.md](mcp/README.md) | MCP server: tools, and setup for Claude Desktop and Claude Code |
| [docs/next-steps.md](docs/next-steps.md) | Status, next steps and data gaps |
| [AGENTS.md](AGENTS.md) | Rules for contributors and AI agents |

## Credits

Built for the Philippine Junior Data Science Challenge (PJDSC) 2026.

Data: DOH Epidemiology Bureau via HDX and Cirrolytix · OpenDengue · © OpenStreetMap
contributors (ODbL), via the Humanitarian OpenStreetMap Team · DOH Pharmaceutical Division
(DPRI) · OCHA COD-AB · geoBoundaries · PSA · Project CCHAIN · Open-Meteo.

## References (APA 7th edition)

Data, methods and policy documents SIGMA uses. Web pages and data sets that change are cited with the date they were retrieved.

Anselin, L. (1995). Local indicators of spatial association—LISA. *Geographical Analysis, 27*(2), 93–115. https://doi.org/10.1111/j.1538-4632.1995.tb00338.x

Bacolod City Government. (2025). *Bacolod City 2025 resolutions: City Resolution 662*. Retrieved October 24, 2026, from https://bacolodcity.gov.ph/2025-resolutions/

Cirrolytix. (2022). *Philippine dengue cases and deaths* [Data set; data from the Department of Health Epidemiology Bureau]. Humanitarian Data Exchange. https://data.humdata.org/dataset/philippine-dengue-cases-and-deaths

City Government of Davao. (2026, January 29). *Davao City 2025 dengue figure down vs 2024*. https://davaocity.gov.ph/health/davao-city-2025-dengue-figure-down-vs-2024/

Clarke, J., Lim, A., Gupte, P., Pigott, D. M., van Panhuis, W. G., & Brady, O. J. (2024). A global dataset of publicly available dengue case count data. *Scientific Data, 11*, Article 296. https://doi.org/10.1038/s41597-024-03120-7

Congress of the Philippines. (2019a). *Republic Act No. 11223: Universal Health Care Act*. https://lawphil.net/statutes/repacts/ra2019/ra_11223_2019.html

Congress of the Philippines. (2019b). *Republic Act No. 11332: Mandatory Reporting of Notifiable Diseases and Health Events of Public Health Concern Act*. https://lawphil.net/statutes/repacts/ra2019/ra_11332_2019.html

Davao City Government. (2023). *Implementing rules and regulations of City Ordinance 0401-20 (Executive Order No. 15, s. 2023)*. https://www.davaocity.gov.ph/wp-content/uploads/2023/09/Signed_RCD-2023-90847_ASD092523-17-EO-25-23_compressed.pdf

Department of Health, Pharmaceutical Division. (2026). *Drug price reference index* (2026 interim ed.) [Data set]. Retrieved October 24, 2026, from https://dpri.doh.gov.ph/drug_search

Department of the Interior and Local Government. (2019, August 9). *Memorandum Circular No. 2019-130: Advocacy on the prevention of dengue and other mosquito-borne diseases*. https://www.dilg.gov.ph/PDF_File/issuances/memo_circulars/dilg-memocircular-201989_f9e6e9c92b.pdf

Department of the Interior and Local Government. (2025, February 24). *Memorandum Circular No. 2025-011: Strengthening local government actions for dengue prevention and control*. https://www.dilg.gov.ph/PDF_File/issuances/memo_circulars/dilg-memocircular-2025224_45c21fce86.pdf

geoBoundaries. (n.d.). *geoBoundaries gbOpen: Philippines, ADM3* [Data set]. William & Mary geoLab. Retrieved October 24, 2026, from https://www.geoboundaries.org/

Hersbach, H., Bell, B., Berrisford, P., Biavati, G., Horányi, A., Muñoz Sabater, J., Nicolas, J., Peubey, C., Radu, R., Rozum, I., Schepers, D., Simmons, A., Soci, C., Dee, D., & Thépaut, J.-N. (2023). *ERA5 hourly data on single levels from 1940 to present* [Data set]. Copernicus Climate Change Service Climate Data Store. https://doi.org/10.24381/cds.adbb2d47

Humanitarian OpenStreetMap Team. (2026). *Philippines health facilities (OpenStreetMap export)* [Data set]. Humanitarian Data Exchange. Retrieved October 13, 2026, from https://data.humdata.org/dataset/hotosm_phl_health_facilities

Hutwagner, L., Thompson, W., Seeman, G. M., & Treadwell, T. (2003). The bioterrorism preparedness and response Early Aberration Reporting System (EARS). *Journal of Urban Health, 80*(Suppl. 1), i89–i96. https://doi.org/10.1007/PL00022319

Knox, E. G. (1964). The detection of space-time interactions. *Journal of the Royal Statistical Society: Series C (Applied Statistics), 13*(1), 25–30. https://doi.org/10.2307/2985220

Moran, P. A. P. (1950). Notes on continuous stochastic phenomena. *Biometrika, 37*(1/2), 17–23. https://doi.org/10.2307/2332142

National Epidemiology Center. (2014). *Manual of procedures for the Philippine Integrated Disease Surveillance and Response* (3rd ed., Vol. 1). Department of Health. https://medbox.org/index.php/dl/5e148832db60a2044c2d3bf2

Office for the Coordination of Humanitarian Affairs. (n.d.). *Philippines: Subnational administrative boundaries* (COD-AB, Version 03) [Data set]. Humanitarian Data Exchange. Retrieved October 24, 2026, from https://data.humdata.org/dataset/cod-ab-phl

OpenAI. (2025). *gpt-oss-20b* [Large language model]. Hugging Face. https://huggingface.co/openai/gpt-oss-20b

OpenDengue. (n.d.). *OpenDengue* (Version 1.3) [Data set]. Retrieved October 24, 2026, from https://opendengue.org/

OpenStreetMap contributors. (2026). *OpenStreetMap* [Data set]. OpenStreetMap Foundation. https://www.openstreetmap.org/

Ord, J. K., & Getis, A. (1995). Local spatial autocorrelation statistics: Distributional issues and an application. *Geographical Analysis, 27*(4), 286–306. https://doi.org/10.1111/j.1538-4632.1995.tb00912.x

Pasig City Government. (2025a, March 6). *Patuloy na pagbaba ng kaso ng dengue sa Pasig, dahil sa sama-samang aksyon* [Continued decline in dengue cases in Pasig through collective action]. https://pasigcity.gov.ph/news-and-releases/patuloy-na-pagbaba-ng-kaso-ng-dengue-sa-pasig-dahil-sa-sama-samang-aksyon-465

Pasig City Government. (2025b, July). *1st semester procurement monitoring report CY2025*. https://assets.pasigcity.gov.ph/storage/annual_procurement_plan/2025/07/13/68737fe0c9f2c17523998401st%20Semester%20Procurement%20Monitoring%20Report%20for%20CY%202025.pdf

Philippine Statistics Authority. (2026). *Philippine Standard Geographic Code (PSGC)* (3rd quarter 2026) [Data set]. https://psa.gov.ph/classification/psgc

Quezon City Government. (2024). *Annual procurement plan FY 2024*. https://quezoncity.gov.ph/wp-content/uploads/2024/01/Annual-Procurement-Plan-F.Y.-2024.pdf

Quezon City Government. (2025, December 15). *Quezon City local government annual report, July 2024–June 2025*. https://quezoncity.gov.ph/wp-content/uploads/2025/12/Quezon-City-Local-Government-Annual-Report-2024-2025.pdf

Republic of the Philippines. (1991). *Republic Act No. 7160: Local Government Code of 1991*. Official Gazette. https://officialgazette.gov.ph/1991/10/10/republic-act-no-7160/

Thinking Machines Data Science. (2024). *Project CCHAIN* [Data set]. Humanitarian Data Exchange. https://data.humdata.org/dataset/project-cchain

Zippenfenig, P. (2023). *Open-Meteo.com weather API* [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.7970649
