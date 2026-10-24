import type { EvidenceKind } from "@/components/ui/evidence-badge";

/**
 * What each data source is for and how far it is from being usable. Feeds the
 * Data Sources page (/data-sources) and GET /api/v1/sources; statuses must
 * match reality:
 * - connected: real records flow through a provider today
 * - demo: the UI uses synthetic stand-ins shaped like this source
 * - planned: identified in research; nothing ingested
 *
 * `sourceId` matches Source.id in data/sample/reference.ts.
 *
 * GADM is deliberately absent: its licence forbids redistribution and
 * commercial use, and the project never uses it (AGENTS.md). Boundaries come
 * from geoBoundaries, matched to OCHA COD-AB; geography sources record their
 * licence and pinned hash in scripts/geo/sources.json.
 */
export type SourceCatalogStatus = "connected" | "demo" | "planned";

export interface SourceCatalogEntry {
  sourceId: string;
  name: string;
  evidence: EvidenceKind | "geography";
  purpose: string;
  status: SourceCatalogStatus;
  resolution: string;
  updateBehavior: string;
  provenance: string;
  accessMethod: string;
  /** Licence as recorded where the data was retrieved; null when not verified. */
  licence: string | null;
  /** Credit line to show wherever the data is displayed. */
  attribution: string;
  /** The source's own page, for clickable citations; null when there is none to link. */
  url: string | null;
}

export const SOURCE_CATALOG: SourceCatalogEntry[] = [
  {
    sourceId: "opendengue",
    name: "OpenDengue v1.3",
    evidence: "formal",
    purpose: "Historical national dengue case counts; the baseline series for ANALYZE.",
    status: "connected",
    resolution: "National · weekly (544 weeks, Dec 30 2012 – Nov 25 2023, with gaps)",
    updateBehavior: "Static v1.3 release. scripts/build_opendengue.py (data track) → processed CSV → web/scripts/build-opendengue.mjs",
    provenance: "Temporal extract (WPRO), PH Admin0; per-row upstream record ids; input SHA-256; planning/OPENDENGUE_RECONCILIATION.md",
    accessMethod: "Bulk download (release extract), processed at build time",
    licence: "CC BY 4.0",
    attribution: "OpenDengue (Clarke et al.), v1.3; national records from WHO WPRO and the Philippine DOH",
    url: "https://opendengue.org/",
  },
  {
    sourceId: "hdx-doh-dengue",
    name: "HDX Philippine Dengue Cases and Deaths (DOH-Epi, 2016–2021)",
    evidence: "formal",
    purpose: "Weekly dengue counts for 126 DOH reporting units; the input to SIGMA's EARS and DOH-threshold map.",
    status: "connected",
    resolution: "126 DOH reporting units (provinces, province remainders, cities) · weekly, 2016-01-10 – 2021-01-03",
    updateBehavior: "Static dataset (last upstream change 2022-05-02). ml/clean_dengue.py → ml/ears.py → ml/export_sigma_web.py → web/public/data/sigma/hdx-dengue-sigma.json",
    provenance: "HDX resource URL and pinned SHA-256 in scripts/geo/sources.json; 665 suspected cases/deaths swap rows and missing weeks are kept as no data; the meaning of the date column is unconfirmed",
    accessMethod: "Bulk download (HDX), processed offline into a committed static export",
    licence: "CC BY",
    attribution: "Cirrolytix via HDX; data attributed to the DOH Epidemiology Bureau",
    url: "https://data.humdata.org/dataset/philippine-dengue-cases-and-deaths",
  },
  {
    sourceId: "gdelt-doc",
    name: "GDELT DOC 2.0",
    evidence: "signal",
    purpose: "Open-source news events for TRACE; each document becomes a SignalSource.",
    status: "demo",
    resolution: "Document-level; location resolved per signal",
    updateBehavior: "Planned polling (~15-minute upstream cadence, rate-limited)",
    provenance: "Per-document URL, publisher and timestamps",
    accessMethod: "API",
    licence: null,
    attribution: "Not ingested; the TRACE signals shown are synthetic stand-ins",
    url: null,
  },
  {
    sourceId: "ph-news-rss",
    name: "Philippine news / RSS feeds",
    evidence: "signal",
    purpose: "Local event reports that GDELT may miss.",
    status: "demo",
    resolution: "Document-level",
    updateBehavior: "Planned per-feed polling",
    provenance: "Per-item link, outlet and publish date",
    accessMethod: "RSS",
    licence: null,
    attribution: "Not ingested; the TRACE signals shown are synthetic stand-ins",
    url: null,
  },
  {
    sourceId: "doh-weekly",
    name: "DOH weekly surveillance reports",
    evidence: "formal",
    purpose: "Official national and regional counts, and advisories as official-report signals.",
    status: "planned",
    resolution: "National / regional (varies by report)",
    updateBehavior: "Weekly PDFs; needs a per-report parser",
    provenance: "Report URL and publication week",
    accessMethod: "Manual / PDF extraction",
    licence: null,
    attribution: "Department of Health (not yet ingested)",
    url: "https://doh.gov.ph/health-statistics/weekly-disease-surveillance-report/",
  },
  {
    sourceId: "ritm-surveillance",
    name: "RITM surveillance reports",
    evidence: "formal",
    purpose: "Laboratory-based cross-validation of formal counts.",
    status: "planned",
    resolution: "National / regional",
    updateBehavior: "Periodic PDFs",
    provenance: "Report URL and date",
    accessMethod: "Manual / PDF extraction",
    licence: null,
    attribution: "Research Institute for Tropical Medicine (not yet ingested)",
    url: "https://ritm.gov.ph/data/surveillance/",
  },
  {
    sourceId: "project-cchain",
    name: "Project CCHAIN climate",
    evidence: "context",
    purpose: "Primary weather covariates for dengue–weather modeling (12 cities, 2003–2022).",
    status: "connected",
    resolution: "Barangay daily (ERA5 / CHIRPS), population-weighted to city-week",
    updateBehavior: "Static release (ends 2022)",
    provenance: "HDX resource URL, SHA-256 and retrieval time",
    accessMethod: "Bulk download (HDX)",
    licence: "CC BY 4.0",
    attribution: "Project CCHAIN (Thinking Machines Data Science) via HDX; ERA5 (Copernicus) and CHIRPS upstream",
    url: "https://data.humdata.org/dataset/project-cchain",
  },
  {
    sourceId: "open-meteo",
    name: "Open-Meteo historical weather (ERA5)",
    evidence: "context",
    purpose: "Extends weather covariates past 2022 and to LGUs outside CCHAIN; compared with CCHAIN as anomalies only.",
    status: "connected",
    resolution: "One ERA5 grid cell per city, daily, rolled up to weekly",
    updateBehavior: "On-demand API, pinned end date",
    provenance: "API parameters, grid cell, SHA-256 and retrieval time",
    accessMethod: "API",
    licence: "CC BY 4.0 (Open-Meteo data; free tier is non-commercial)",
    attribution: "Weather data by Open-Meteo.com; ERA5 from the Copernicus Climate Change Service",
    url: "https://open-meteo.com/en/docs/historical-weather-api",
  },
  {
    sourceId: "hotosm-phl-health-facilities",
    name: "HOT OpenStreetMap export: Philippines health facilities",
    evidence: "context",
    purpose: "Hospitals, clinics, pharmacies and laboratories mapped in OpenStreetMap, counted per reporting unit for ACCESS.",
    status: "connected",
    resolution:
      "Point locations assigned to the 126 reporting units; one snapshot (2026-10-13). 15,586 of 19,129 features kept after removing other facility types, duplicates and unassigned points",
    updateBehavior:
      "Static snapshot (upstream modified 2026-10-13, pinned 2026-10-24). scripts/access/fetch-sources.mjs → scripts/access/build-access.mjs → web/src/data/access/access-reference.json and web/public/data/access/facilities.json",
    provenance:
      "HDX dataset, HOT export URL and pinned SHA-256 in scripts/access/sources.json; the fetch refuses a file whose hash changed. Mapping completeness varies, so a low count can mean low mapping, not low access",
    accessMethod: "Bulk download (HOT export via HDX), processed at build time",
    licence: "ODbL 1.0",
    attribution: "© OpenStreetMap contributors, ODbL",
    url: "https://data.humdata.org/dataset/hotosm_phl_health_facilities",
  },
  {
    sourceId: "doh-dpri-dashboard",
    name: "DOH Drug Price Reference Index (DPRI)",
    evidence: "context",
    purpose:
      "Public-sector prices for the dengue supportive-care medicines in ACCESS: paracetamol, ORS, Lactated Ringer's and 0.9% sodium chloride.",
    status: "connected",
    resolution:
      "National · lowest, median and highest price per item paid by DOH hospitals in 2025 procurement (11 items across 4 medicines)",
    updateBehavior:
      "Static edition (2026 Interim DPRI, 14th edition, as of 2026-07-29). The dashboard page is saved by hand because dpri.doh.gov.ph answers scripted requests with 403, then processed by scripts/access/build-access.mjs",
    provenance:
      "Dashboard URL, edition and pinned SHA-256 in scripts/access/sources.json; the medicine list follows the PNF Essential Medicines List (8th ed.). Prices are what DOH hospitals paid, not private shelf prices",
    accessMethod: "Manual download (saved dashboard page), processed at build time",
    licence: "Philippine government work (RA 8293 s.176): no copyright; prior approval needed for commercial use",
    attribution: "DOH Pharmaceutical Division, Drug Price Reference Index (2026 interim edition, procurement year 2025)",
    url: "https://dpri.doh.gov.ph/drug_search",
  },
  {
    sourceId: "geoboundaries",
    name: "geoBoundaries gbOpen PHL ADM3",
    evidence: "geography",
    purpose: "Display polygons for the HDX reporting units on the SIGMA map.",
    status: "connected",
    resolution: "Municipality/city (ADM3, 2020), simplified, dissolved into the 126 reporting units",
    updateBehavior: "Pinned commit of a versioned release; rebuilt by scripts/geo/build-boundaries.mjs",
    provenance: "GitHub release URL at a pinned commit and SHA-256 in scripts/geo/sources.json",
    accessMethod: "Bulk download, processed at build time",
    licence: "CC BY 3.0 IGO",
    attribution: "geoBoundaries (Runfola et al. 2020); boundaries from NAMRIA, PSA and OCHA Philippines",
    url: "https://www.geoboundaries.org/",
  },
  {
    sourceId: "cod-ab-phl",
    name: "OCHA COD-AB Philippines (v03)",
    evidence: "geography",
    purpose: "Reference administrative units and p-codes that the HDX reporting units are matched to.",
    status: "connected",
    resolution: "Region → municipality/city (tabular attributes)",
    updateBehavior: "Pinned file; rebuilt by scripts/geo/build-geo.mjs",
    provenance: "HDX resource URL and SHA-256 in scripts/geo/sources.json",
    accessMethod: "Bulk download (HDX), processed at build time",
    licence: "CC BY-IGO",
    attribution: "OCHA FISS; source NAMRIA and PSA",
    url: "https://data.humdata.org/dataset/cod-ab-phl",
  },
  {
    sourceId: "psa-psgc",
    name: "PSA PSGC (3Q 2026)",
    evidence: "geography",
    purpose: "Authoritative geographic codes and city classes, used at build time to check the crosswalk.",
    status: "connected",
    resolution: "Region → barangay",
    updateBehavior: "Quarterly PSA publications; the file is downloaded by hand (psa.gov.ph blocks scripts)",
    provenance: "PSGC edition and code, recorded per row in data/reference/geo/hdx_dengue_crosswalk.csv",
    accessMethod: "Manual download, kept in git-ignored data/raw; only derived codes are committed",
    licence: "PSA terms of use (file not redistributed)",
    attribution: "Philippine Statistics Authority, Philippine Standard Geographic Code",
    url: "https://psa.gov.ph/classification/psgc",
  },
  {
    sourceId: "openstreetmap",
    name: "OpenStreetMap",
    evidence: "geography",
    purpose: "Basemap tiles (fallback) and finer boundaries where mapped.",
    status: "connected",
    resolution: "Tiles; basemap only, no analytical data",
    updateBehavior: "Live tiles",
    provenance: "© OpenStreetMap contributors",
    accessMethod: "Tile server",
    licence: "ODbL",
    attribution: "© OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/",
  },
];
