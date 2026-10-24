# SIGMA: status and next steps

Last updated 2026-10-24 (PR #16, `feat/analyze-consolidation`). Keep this file current: tick items when they merge, and add a line with the PR number.

## In plain language

SIGMA now has three main tabs (Overview, Explore, Analyze), shows only real data, and has an assistant (SIGI) that answers questions about any of the 126 dengue reporting units from that data with its sources. What it still cannot do: say whether medicines are in stock anywhere, give per-person rates, or forecast. Those need data that is not public yet.

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

- [x] Spatial analysis of the EARS signals (method doc §4.2 steps 3–7 and the §4.4 validation): neighbour weights, weekly Moran's I, local Moran / Gi*, Knox space-time test, local vs aggregate lead time; results in `docs/geo/spatial-analysis-report.md`, meaning in `docs/geo/spatial-assessment-and-method.md` §6.2. (`feat/spatial-analysis`)

## In progress

- [ ] Mobile app rebuilt on the three-tab structure and real data (Overview, Explore by reporting unit, Analyze: ACCESS / SIGI / Lab).
- [ ] Web polish pass with the #15 design system on Overview, Explore, Analyze and Data Sources, checked by screenshot at 1440 px and 390 px.

## Next (no external blocker)

- [ ] Live-test SIGI answers with a model key: run the suggested questions for 3–5 units, check that every claim cites the right place, and refine `web/src/lib/analyze-chat/playbook.ts`.
- [ ] Policy coverage: only Quezon City, Pasig, Davao City and Bacolod City have local records. Add verified local issuances for more units, starting with the highest-burden ones.
- [ ] National DOH issuances behind doh.gov.ph's Cloudflare block (AO 2018-0021 Enhanced 4S, the dengue programme AO): obtain official copies and add them.
- [ ] Connect EARS results to `/api/v1/dengue/signals` (still `not_connected`).
- [ ] Map cluster layer: only if a local cluster class is made stable across neighbour definitions (today κ 0.11–0.23 between W1 and W2/W3; see `docs/geo/spatial-assessment-and-method.md` §6.2). The weekly Moran's I and Knox results can be shown as national context now.
- [ ] End-to-end browser tests in CI (navigation, Analyze subtabs, SIGI empty/error states).
- [ ] Confirm the meaning of the HDX `date` column and pick one week offset for the map and the environment track (GEO-4).
- [ ] Re-run `environment.crosscheck` with swap rows excluded; seed `ml/environment/input_pins.json`.
- [ ] Set the EAS production `EXPO_PUBLIC_API_BASE_URL` to the deployed API.

## Blocked by data that is not available

| Gap | Why | What would unblock it |
| --- | --- | --- |
| Medicine stock / stock-outs per facility | No public source; DOH EDPMS is login-only | A DOH or LGU data-sharing arrangement, or a pharmacy partner feed |
| What people search for | SIGMA collects no search data; no public source | An opt-in search log in the product, or a partner dataset |
| Per-person rates (facilities per 10,000, incidence) | City and province-remainder population is not in the repo | PSA population by city/municipality (manual download, not redistributable): keep it local and commit only derived rates if the licence allows |
| Retail medicine prices | DPRI covers public-hospital procurement only | DOH price monitoring access or a retail survey |
| Forecasting | No fitted model; Simulate was removed | A validated model (e.g. SARIMA or a spatial model) scored against held-out seasons |
