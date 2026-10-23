import type { ApiSource } from "@sigma/contracts";
import { SOURCE_CATALOG, type SourceCatalogEntry } from "@/data/source-catalog";
import { OPENDENGUE_META } from "@/data/opendengue-provider";
import type { DengueSourceDescriptor } from "./dengue";

/**
 * Source catalogue → API sources.
 *
 * The catalogue in `data/source-catalog.ts` states how far each source is
 * from being usable. The API keeps that honesty: a planned source is
 * reported as `planned`, and its coverage window is null rather than a guess.
 */

/** Coverage facts that the catalogue stores as prose. */
const COVERAGE: Record<string, { from: string | null; to: string | null; geographicLevel: string }> = {
  opendengue: { from: "2012-12-30", to: "2023-11-25", geographicLevel: "national" },
  "gdelt-doc": { from: null, to: null, geographicLevel: "per-signal" },
  "ph-news-rss": { from: null, to: null, geographicLevel: "per-signal" },
  "doh-weekly": { from: null, to: null, geographicLevel: "national_or_regional" },
  "ritm-surveillance": { from: null, to: null, geographicLevel: "national_or_regional" },
  "open-meteo": { from: null, to: null, geographicLevel: "point" },
  "hdx-doh-dengue": { from: "2016-01-10", to: "2021-01-03", geographicLevel: "doh_reporting_unit" },
  geoboundaries: { from: null, to: null, geographicLevel: "municipality_city" },
  "cod-ab-phl": { from: null, to: null, geographicLevel: "region_to_municipality" },
  "psa-psgc": { from: null, to: null, geographicLevel: "region_to_barangay" },
  openstreetmap: { from: null, to: null, geographicLevel: "tiles" },
};

/** One line saying what a source can and cannot answer. */
const SCOPE: Record<string, string> = {
  opendengue:
    "Historical national reported dengue case counts only. Not a forecast, not sub-national, and not a confirmed outbreak statement.",
  "gdelt-doc":
    "Open-source document activity. Never a case count and never a confirmation of an outbreak.",
  "ph-news-rss":
    "Open-source document activity. Never a case count and never a confirmation of an outbreak.",
  "doh-weekly":
    "Official reported counts and advisories once a parser exists. Today nothing is ingested from it.",
  "ritm-surveillance":
    "Laboratory-confirmed counts for cross-validation. Today nothing is ingested from it.",
  "open-meteo":
    "Environmental covariates for models. Never an epidemiological finding on its own.",
  "hdx-doh-dengue":
    "Retrospective weekly counts per DOH reporting unit, 2016–2021. A province remainder is not the whole province, swap rows and missing weeks are no data, and the date column's meaning is unconfirmed. Not live surveillance.",
  geoboundaries: "Display polygons only. Not health data and not an official boundary determination.",
  "cod-ab-phl": "Reference units and p-codes for matching places. Not health data.",
  "psa-psgc": "Authoritative area codes for joining systems, not health data.",
  openstreetmap: "Basemap tiles only. No analytical content.",
};

function toApiSource(entry: SourceCatalogEntry): ApiSource {
  const coverage = COVERAGE[entry.sourceId] ?? {
    from: null,
    to: null,
    geographicLevel: "unspecified",
  };
  return {
    id: entry.sourceId,
    name: entry.name,
    status: entry.status,
    evidence: entry.evidence,
    purpose: entry.purpose,
    scope: SCOPE[entry.sourceId] ?? entry.purpose,
    coverage: {
      from: coverage.from,
      to: coverage.to,
      geographicLevel: coverage.geographicLevel,
      resolution: entry.resolution,
    },
    provenance: entry.provenance,
    accessMethod: entry.accessMethod,
    licence: entry.licence,
    attribution: entry.attribution,
  };
}

export function buildSources(): ApiSource[] {
  return SOURCE_CATALOG.map(toApiSource);
}

/** The OpenDengue series descriptor used by the dengue endpoints. */
export function opendengueDescriptor(): DengueSourceDescriptor {
  return {
    id: "opendengue",
    name: `OpenDengue ${OPENDENGUE_META.version}`,
    version: OPENDENGUE_META.version,
    extract: OPENDENGUE_META.extract,
    filter: OPENDENGUE_META.filter,
    citation: OPENDENGUE_META.citation,
    license: OPENDENGUE_META.license,
    upstreamUrl: OPENDENGUE_META.upstreamUrl,
    from: OPENDENGUE_META.validated.firstStart,
    to: OPENDENGUE_META.validated.lastEnd,
    rows: OPENDENGUE_META.validated.rows,
  };
}
