# SIGMA: status

Last updated 2026-10-24. Every item that was on this list is done or decided. What SIGMA cannot do is listed under
[Known limitations](#known-limitations): those need data or answers from outside the team, so they are not open work.
Keep this file current: add a line when something lands, with the commit or PR.

## In plain language

SIGMA has three main tabs (Overview, Explore, Analyze), shows only real data, and has an assistant (SIGI) that answers
questions about any of the 126 dengue reporting units from that data, with its sources. The Android app installs and
finds the API on its own. The API and an MCP server let other tools and AI clients use the same data. What SIGMA still
cannot do: say whether medicines are in stock anywhere, give per-person rates, or forecast. Those need data that is not
public.

## Done

- [x] Three primary tabs: Overview / Explore / Analyze (ACCESS · Policy · Lab under `/analyze/*`); old `/lab`, `/policy`, `/access`, `/simulate` redirect. (#16)
- [x] Simulate removed: it was a deterministic demo curve, not a fitted model. (#14, #16)
- [x] Landing cover and boot splash; cover without Sigi, scanned 8-bit map of the 126 units. (#14, #16)
- [x] No demo data on any user-facing page; the sidebar and top bar state the real sources. (#16)
- [x] ACCESS on real, pinned sources: OpenStreetMap facilities (HOT/HDX, ODbL, snapshot 2026-10-13) and DOH Drug Price Reference Index 2026; `/api/v1/access/units`, `/api/v1/access/medicines`. (#16)
- [x] SIGI in Analyze → Policy: server-built evidence pack per reporting unit (Lab, ACCESS, Policy, methods), server-verified citations, other places' ids rejected, optional comparison, playbook. (#16)
- [x] Nine national policy records verified (RA 11332 Secs. 6–8, PIDSR MOP s. 5.3.5 and LGU roles, DILG MC 2019-130, MC 2025-011, RA 11223 Sec. 17(b)). (#16)
- [x] Lab on real data only: OpenDengue national trend, per-unit EARS/DOH analysis, method and data quality. (#16)
- [x] Data Sources page from the source catalogue (single source of truth). (#16)
- [x] Design system from #15 (tokens, StatStrip, PageHeader, segmented control, responsive shell). (#16)
- [x] Epi (MMWR) years used everywhere results are grouped by year. (#16)
- [x] Spatial analysis of the EARS signals (method doc §4.2 steps 3–7 and the §4.4 validation): neighbour weights, weekly Moran's I, local Moran / Gi*, Knox space-time test, local vs aggregate lead time; results in `docs/geo/spatial-analysis-report.md`, meaning in `docs/geo/spatial-assessment-and-method.md` §6.2. (#20)
- [x] EARS results served by `/api/v1/dengue/signals` (per unit and week, from the committed export); `/health` reports the engine as ok and the retired `/access/metrics` as disabled. (#21)
- [x] MCP server (`mcp/`): the read-only API as tools for Claude and other MCP clients. (#21)
- [x] Mobile app rebuilt on the three-tab structure and real data (Overview, Explore by reporting unit, Analyze: ACCESS / SIGI / Lab); Overview and Explore follow the 2026-10-24 design references; emulator screenshots in `docs/mobile-view/`. (#18, #21)
- [x] The app finds the API by itself (#21), and an installed APK never keeps a saved `localhost` address from an older build. Newest preview APK in [mobile.md](mobile.md).
- [x] EAS `preview` and `production` profiles set `EXPO_PUBLIC_API_BASE_URL` to the deployed API (`mobile/eas.json`).
- [x] Web polish pass with the #15 design system on Overview, Explore, Analyze and Data Sources, checked by screenshot at 1440 px and 390 px.
- [x] End-to-end browser tests in CI (navigation, Analyze subtabs, SIGI empty/error states), mocked so they never call a model.
- [x] Documentation tab: `/policy/info` rebuilt from real data, `/policy/evidence` and `/chat` report `live`, and the never-ingested GDELT / RSS sources leave the catalogue. Only `/access/metrics` stays `not_connected`, on purpose: no public source reports medicine stock or searches.
- [x] SIGI live-tested on 5 units (Quezon City, Davao City, Abra, Cebu City, Zamboanga City), 10 questions: no answer cited another place. Fixed what the test found: ids written with typographic hyphens lost their sources (now normalised), one long table was cut off (the playbook asks for short answers), and the prompt now puts the place-free part first so Groq's prompt cache can serve it.
- [x] HDX `date` column (GEO-4): decision recorded in [dengue-pipeline.md](dengue-pipeline.md#hdx-week-convention-known-vs-unconfirmed). Everything SIGMA shows uses the date as given (0 d); the environment track keeps −14 d only for its CCHAIN cross-check; weather comparisons use lag windows.
- [x] `environment.crosscheck` re-run with the 665 swap rows excluded (2026-10-24): the best HDX offset is still −14 d (mean r 0.834; −7 d 0.823), matching the configured offset. `ml/environment/input_pins.json` seeded with the SHA-256 of the six HDX and CCHAIN inputs.
- [x] Geography backlog closed: GEO-1 (one id scheme, recorded in [architecture.md](architecture.md)), GEO-2, GEO-3, GEO-5, P0-1, P0-2, P1-1, P2-6; see [geo/README.md](geo/README.md).

## Decisions (scope of the prototype)

- **Local policy records cover four case-study cities**: Quezon City, Pasig, Davao City and Bacolod City. Every unit gets
  the national records, and SIGI says plainly when a unit has no local record. More cities means more document review,
  not a missing feature.
- **National DOH administrative orders are not records.** doh.gov.ph blocks automated access, and AO 2018-0021
  (Enhanced 4S) is only available as secondary copies, so it cannot be verified to the registry's standard. The 4S
  strategy is still covered: DILG MC 2019-130, a verified record, directs LGUs to apply it.
- **No map cluster layer.** Local cluster classes are not stable across neighbour definitions (κ 0.11–0.23 between W1
  and W2/W3; `docs/geo/spatial-assessment-and-method.md` §6.2), so mapping them would show noise as clusters. The
  weekly Moran's I and Knox results stay in `docs/geo/spatial-analysis-report.md` as national context.
- **The HDX week offset**: see GEO-4 above.

## Known limitations

| Gap | Why | What would unblock it |
| --- | --- | --- |
| Medicine stock / stock-outs per facility | No public source; DOH EDPMS is login-only | A DOH or LGU data-sharing arrangement, or a pharmacy partner feed |
| What people search for | SIGMA collects no search data; no public source | An opt-in search log in the product, or a partner dataset |
| Per-person rates (facilities per 10,000, incidence) | City and province-remainder population is not in the repo | PSA population by city/municipality (manual download, not redistributable): keep it local and commit only derived rates if the licence allows |
| Retail medicine prices | DPRI covers public-hospital procurement only | DOH price monitoring access or a retail survey |
| Forecasting | No fitted model; Simulate was removed | A validated model (e.g. SARIMA or a spatial model) scored against held-out seasons |
| What the HDX `date` means | Undocumented upstream | An answer from DOH-EB or Cirrolytix |
| SIGI throughput | Groq's base limit for `openai/gpt-oss-20b` is 8K tokens per minute and 200K per day, and one question sends ~7.5K prompt tokens (less when the cache hits). Pace questions about a minute apart in a demo. | A paid Groq tier, or a model with higher limits (`GROQ_MODEL`) after re-running the live test |
