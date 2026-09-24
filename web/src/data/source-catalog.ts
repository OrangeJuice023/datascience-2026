import type { EvidenceKind } from "@/components/ui/evidence-badge";

/**
 * What each data source is for and how far it is from being usable. Feeds a
 * future Data Sources page; statuses must match reality:
 * - connected: real records flow through a provider today
 * - demo: the UI uses synthetic stand-ins shaped like this source
 * - planned: identified in research; nothing ingested
 *
 * `sourceId` matches Source.id in data/sample/reference.ts.
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
  },
  {
    sourceId: "open-meteo",
    name: "Open-Meteo historical weather",
    evidence: "context",
    purpose: "Rainfall and temperature covariates for baseline and model inputs.",
    status: "planned",
    resolution: "Point-level daily, rolled up to weekly per geography",
    updateBehavior: "On-demand API",
    provenance: "API parameters and retrieval time",
    accessMethod: "API",
  },
  {
    sourceId: "gadm",
    name: "GADM boundaries",
    evidence: "geography",
    purpose: "Administrative polygons for map layers.",
    status: "planned",
    resolution: "Region → barangay (version-dependent)",
    updateBehavior: "Versioned releases",
    provenance: "GADM version and gid",
    accessMethod: "Bulk download",
  },
  {
    sourceId: "psa-psgc",
    name: "PSA PSGC",
    evidence: "geography",
    purpose: "Authoritative geographic codes; the cross-system join key.",
    status: "planned",
    resolution: "Region → barangay",
    updateBehavior: "Quarterly PSA publications",
    provenance: "PSGC publication date and code",
    accessMethod: "Bulk download",
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
  },
];
