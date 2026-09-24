import type { Disease, Source } from "@/types/data";
import { SAMPLE_RECORDED_AT } from "./provenance";

/**
 * Tracked diseases and syndromes. These are reference definitions, not
 * statistics, so they are not flagged as sample records. Names match the
 * disease labels used by the existing demo signals.
 */
export const DISEASES: Disease[] = [
  { id: "dengue", name: "Dengue", aliases: ["dengue fever", "severe dengue", "DHF"] },
  { id: "leptospirosis", name: "Leptospirosis", aliases: [] },
  { id: "measles", name: "Measles", aliases: [] },
  { id: "influenza-like-illness", name: "Influenza-like illness", aliases: ["ILI"] },
  { id: "diarrheal-disease", name: "Diarrheal disease", aliases: ["acute watery diarrhea"] },
].map((disease): Disease => ({
  ...disease,
  provenance: {
    sourceIds: ["sigma"],
    method: "manual",
    recordedAt: SAMPLE_RECORDED_AT,
    isSample: false,
  },
}));

const REGISTRY_DATE = "2026-09-23T00:00:00Z";

/**
 * Real sources SIGMA intends to use. None is connected yet (status
 * "planned"). License, attribution and resolution stay null / empty unless
 * verified against the source's own documentation; see
 * docs/data-sources.md for the evidence behind each value.
 */
export const PLANNED_SOURCES: Source[] = [
  {
    id: "opendengue",
    name: "OpenDengue",
    type: "formal_surveillance",
    url: "https://opendengue.org/",
    accessMethod: "bulk_download",
    license: null,
    attribution: null,
    geographicLevels: [],
    temporalResolution: null,
    status: "planned",
    metadataVerifiedAt: null,
    isSample: false,
    createdAt: REGISTRY_DATE,
    updatedAt: REGISTRY_DATE,
  },
  {
    id: "gdelt-doc",
    name: "GDELT DOC 2.0 API",
    type: "news_aggregator",
    url: "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
    accessMethod: "api",
    license: null,
    attribution: null,
    geographicLevels: [],
    temporalResolution: null,
    status: "planned",
    metadataVerifiedAt: null,
    isSample: false,
    createdAt: REGISTRY_DATE,
    updatedAt: REGISTRY_DATE,
  },
  {
    id: "ph-news-rss",
    name: "Philippine news RSS feeds (one row per feed once onboarded)",
    type: "news",
    url: null,
    accessMethod: "rss",
    license: null,
    attribution: null,
    geographicLevels: [],
    temporalResolution: null,
    status: "planned",
    metadataVerifiedAt: null,
    isSample: false,
    createdAt: REGISTRY_DATE,
    updatedAt: REGISTRY_DATE,
  },
  {
    id: "psa-psgc",
    name: "PSA Philippine Standard Geographic Code (PSGC)",
    type: "geographic_reference",
    url: "https://psa.gov.ph/classification/psgc",
    accessMethod: "bulk_download",
    license: null,
    attribution: null,
    geographicLevels: [],
    temporalResolution: null,
    status: "planned",
    metadataVerifiedAt: null,
    isSample: false,
    createdAt: REGISTRY_DATE,
    updatedAt: REGISTRY_DATE,
  },
  {
    id: "gadm",
    name: "GADM administrative boundaries",
    type: "geographic_reference",
    url: "https://gadm.org/",
    accessMethod: "bulk_download",
    license: null,
    attribution: null,
    geographicLevels: [],
    temporalResolution: null,
    status: "planned",
    metadataVerifiedAt: null,
    isSample: false,
    createdAt: REGISTRY_DATE,
    updatedAt: REGISTRY_DATE,
  },
  {
    id: "openstreetmap",
    name: "OpenStreetMap",
    type: "geographic_reference",
    url: "https://www.openstreetmap.org/",
    accessMethod: "api",
    license: null,
    attribution: null,
    geographicLevels: [],
    temporalResolution: null,
    status: "planned",
    metadataVerifiedAt: null,
    isSample: false,
    createdAt: REGISTRY_DATE,
    updatedAt: REGISTRY_DATE,
  },
  {
    id: "open-meteo",
    name: "Open-Meteo Historical Weather API",
    type: "environmental",
    url: "https://open-meteo.com/",
    accessMethod: "api",
    license: null,
    attribution: null,
    geographicLevels: [],
    temporalResolution: null,
    status: "planned",
    metadataVerifiedAt: null,
    isSample: false,
    createdAt: REGISTRY_DATE,
    updatedAt: REGISTRY_DATE,
  },
];

/** SIGMA itself: the source of model outputs and curated reference rows. */
export const SIGMA_SOURCE: Source = {
  id: "sigma",
  name: "SIGMA analytics (internal)",
  type: "sigma_internal",
  url: null,
  accessMethod: "internal",
  license: null,
  attribution: null,
  geographicLevels: [],
  temporalResolution: null,
  status: "active",
  metadataVerifiedAt: null,
  isSample: false,
  createdAt: REGISTRY_DATE,
  updatedAt: REGISTRY_DATE,
};

function sampleSource(
  source: Pick<Source, "id" | "name" | "type" | "accessMethod" | "geographicLevels" | "temporalResolution">,
): Source {
  return {
    ...source,
    url: null,
    license: null,
    attribution: null,
    status: "active",
    metadataVerifiedAt: null,
    isSample: true,
    createdAt: SAMPLE_RECORDED_AT,
    updatedAt: SAMPLE_RECORDED_AT,
  };
}

/**
 * DEMO / SAMPLE sources. Synthetic channels that feed the sample records.
 * They are deliberately not named after real outlets or agencies.
 */
export const SAMPLE_SOURCES: Source[] = [
  sampleSource({
    id: "sample-formal-feed",
    name: "Sample formal surveillance feed (synthetic)",
    type: "formal_surveillance",
    accessMethod: "bulk_download",
    geographicLevels: ["national"],
    temporalResolution: "weekly",
  }),
  sampleSource({
    id: "sample-government-releases",
    name: "Sample government releases (synthetic)",
    type: "government_release",
    accessMethod: "rss",
    geographicLevels: ["national", "regional", "provincial"],
    temporalResolution: null,
  }),
  sampleSource({
    id: "sample-lgu-advisories",
    name: "Sample LGU advisories (synthetic)",
    type: "lgu_release",
    accessMethod: "manual",
    geographicLevels: ["municipal", "barangay"],
    temporalResolution: null,
  }),
  sampleSource({
    id: "sample-news-feed",
    name: "Sample news RSS feed (synthetic)",
    type: "news",
    accessMethod: "rss",
    geographicLevels: [],
    temporalResolution: null,
  }),
  sampleSource({
    id: "sample-news-index",
    name: "Sample news index (synthetic, GDELT-shaped)",
    type: "news_aggregator",
    accessMethod: "api",
    geographicLevels: [],
    temporalResolution: null,
  }),
  sampleSource({
    id: "sample-community",
    name: "Sample community reports (synthetic)",
    type: "other",
    accessMethod: "manual",
    geographicLevels: [],
    temporalResolution: null,
  }),
  sampleSource({
    id: "sample-geo-reference",
    name: "Demo geographic reference (not reconciled to PSGC)",
    type: "geographic_reference",
    accessMethod: "manual",
    geographicLevels: ["national", "regional", "provincial", "municipal", "barangay"],
    temporalResolution: null,
  }),
];
