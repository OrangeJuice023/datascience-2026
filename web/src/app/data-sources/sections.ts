import type { SourceCatalogEntry } from "@/data/source-catalog";

/**
 * How the Data Sources page groups the catalogue, and where each source
 * shows up in SIGMA. The facts about a source (licence, coverage, credit
 * line) stay in `data/source-catalog.ts`; this file only says which section
 * it belongs to and which pages use it.
 *
 * Only a `connected` source is ever placed in a topic section. A demo or
 * planned source goes to "Not connected" whatever this file says, so a
 * status change in the catalogue cannot make the page overstate a source.
 */

export type SourceGroupId = "surveillance" | "environment" | "access" | "geography";

export interface SourceGroup {
  id: SourceGroupId;
  title: string;
  intro: string;
  /** Catalogue ids, in display order. */
  sourceIds: string[];
}

export const SOURCE_GROUPS: SourceGroup[] = [
  {
    id: "surveillance",
    title: "Disease surveillance",
    intro:
      "Reported dengue cases: the counts SIGMA's signals are computed from. Both datasets are historical, and neither is a live feed.",
    sourceIds: ["opendengue", "hdx-doh-dengue"],
  },
  {
    id: "environment",
    title: "Environment",
    intro:
      "Weather around the dengue signals. Context only: it can inform a reading of the counts, never confirm or explain an outbreak on its own.",
    sourceIds: ["project-cchain", "open-meteo"],
  },
  {
    id: "access",
    title: "Access",
    intro:
      "Where care is mapped and what dengue medicines cost the public sector. Medicine stock, stock-outs and what people search for have no public source, so SIGMA shows them as unknown, never as zero.",
    sourceIds: ["hotosm-phl-health-facilities", "doh-dpri-dashboard"],
  },
  {
    id: "geography",
    title: "Geography",
    intro:
      "Places, codes and boundaries that let the counts be matched and drawn on a map. None of it is health data. GADM is deliberately not used: its licence forbids redistribution.",
    sourceIds: ["geoboundaries", "cod-ab-phl", "psa-psgc", "openstreetmap"],
  },
];

export interface SourceUse {
  label: string;
  href: string;
  /** What the page shows from the source, when the page alone is not enough. */
  detail?: string;
}

export interface SourceUsage {
  /**
   * "fixed": a copy downloaded once and bundled; "live": fetched from the
   * provider as the page loads. Left out for a source that is not connected.
   */
  refresh?: "fixed" | "live";
  uses: SourceUse[];
  /** Said instead of page links when the source is only used while building the data. */
  buildOnly?: string;
}

const COPILOT: SourceUse = { label: "Analyze › Policy", href: "/analyze/policy", detail: "copilot evidence" };

/** Where each source appears. Keyed by catalogue `sourceId`. */
export const SOURCE_USAGE: Record<string, SourceUsage> = {
  opendengue: {
    refresh: "fixed",
    uses: [
      { label: "Overview", href: "/", detail: "national series" },
      { label: "Analyze › Lab", href: "/analyze/lab", detail: "national trend" },
      COPILOT,
      { label: "API", href: "/documentation#group-surveillance", detail: "/dengue/*" },
    ],
  },
  "hdx-doh-dengue": {
    refresh: "fixed",
    uses: [
      { label: "Explore", href: "/explore", detail: "cases, EARS and DOH threshold views" },
      { label: "Overview", href: "/", detail: "SIGMA results" },
      { label: "Analyze › Lab", href: "/analyze/lab", detail: "reporting units" },
      { label: "Analyze › ACCESS", href: "/analyze/access", detail: "reported cases per unit" },
      COPILOT,
    ],
  },
  "project-cchain": {
    refresh: "fixed",
    uses: [{ label: "Explore", href: "/explore", detail: "Environment view" }],
  },
  "open-meteo": {
    refresh: "fixed",
    uses: [{ label: "Explore", href: "/explore", detail: "Environment view" }],
  },
  "hotosm-phl-health-facilities": {
    refresh: "fixed",
    uses: [
      { label: "Analyze › ACCESS", href: "/analyze/access", detail: "facility map and counts" },
      COPILOT,
      { label: "API", href: "/documentation#group-access", detail: "/access/units" },
    ],
  },
  "doh-dpri-dashboard": {
    refresh: "fixed",
    uses: [
      { label: "Analyze › ACCESS", href: "/analyze/access", detail: "medicine prices" },
      COPILOT,
      { label: "API", href: "/documentation#group-access", detail: "/access/medicines" },
    ],
  },
  geoboundaries: {
    refresh: "fixed",
    uses: [
      { label: "Explore", href: "/explore", detail: "reporting-unit polygons" },
      { label: "Analyze › ACCESS", href: "/analyze/access", detail: "map polygons" },
    ],
  },
  "cod-ab-phl": {
    refresh: "fixed",
    uses: [],
    buildOnly: "Build time only: matching the HDX reporting units to p-codes (scripts/geo/build-geo.mjs).",
  },
  "psa-psgc": {
    refresh: "fixed",
    uses: [],
    buildOnly: "Build time only: checking the geography crosswalk; the file itself is not redistributed.",
  },
  openstreetmap: {
    refresh: "live",
    uses: [
      { label: "Explore", href: "/explore", detail: "basemap" },
      { label: "Analyze › ACCESS", href: "/analyze/access", detail: "basemap" },
    ],
    buildOnly: "Used as the basemap when no MapTiler key or custom map style is configured.",
  },
};

export interface GroupedCatalog {
  groups: { group: SourceGroup; entries: SourceCatalogEntry[] }[];
  /** Connected sources that no section lists; shown under their own heading rather than dropped. */
  ungrouped: SourceCatalogEntry[];
  /** Demo and planned sources, in catalogue order. */
  notConnected: SourceCatalogEntry[];
}

export function groupCatalog(catalog: SourceCatalogEntry[]): GroupedCatalog {
  const byId = new Map(catalog.map((entry) => [entry.sourceId, entry]));
  const placed = new Set<string>();
  const groups = SOURCE_GROUPS.map((group) => {
    const entries = group.sourceIds
      .map((id) => byId.get(id))
      .filter((entry): entry is SourceCatalogEntry => entry !== undefined && entry.status === "connected");
    for (const entry of entries) placed.add(entry.sourceId);
    return { group, entries };
  });
  return {
    groups,
    ungrouped: catalog.filter((entry) => entry.status === "connected" && !placed.has(entry.sourceId)),
    notConnected: catalog.filter((entry) => entry.status !== "connected"),
  };
}
