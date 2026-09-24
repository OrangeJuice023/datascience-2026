import type { GeographicEntity } from "@/types/data";
import { DEMO_LGUS } from "@/data/demo-lgus";
import { sampleProvenance } from "./provenance";

/**
 * DEMO / SAMPLE geographic reference.
 *
 * National, regional, provincial and municipal names are real places;
 * centroids are the approximate demo coordinates. Nothing here has been
 * reconciled against a PSGC publication, so every psgcCode is null. The
 * barangay entries are placeholders, not real barangays.
 */
const provenance = sampleProvenance(["sample-geo-reference"], "manual");

const HIGHER_LEVELS: GeographicEntity[] = [
  { id: "ph", name: "Philippines", level: "national", parentId: null, psgcCode: null, centroid: null, provenance },
  { id: "ncr", name: "National Capital Region (NCR)", level: "regional", parentId: "ph", psgcCode: null, centroid: null, provenance },
  { id: "calabarzon", name: "Region IV-A (CALABARZON)", level: "regional", parentId: "ph", psgcCode: null, centroid: null, provenance },
  { id: "rizal", name: "Rizal", level: "provincial", parentId: "calabarzon", psgcCode: null, centroid: null, provenance },
];

/** The demo LGU table labels NCR cities with "Metro Manila"; NCR has no province, so they sit under the region. */
const PARENT_BY_DEMO_PROVINCE: Record<string, string> = {
  "Metro Manila": "ncr",
  Rizal: "rizal",
};

const MUNICIPAL: GeographicEntity[] = DEMO_LGUS.map((lgu): GeographicEntity => ({
  id: lgu.id,
  name: lgu.name,
  level: "municipal",
  parentId: PARENT_BY_DEMO_PROVINCE[lgu.province] ?? "ph",
  psgcCode: null,
  centroid: { latitude: lgu.latitude, longitude: lgu.longitude },
  provenance,
}));

const PLACEHOLDER_BARANGAYS: GeographicEntity[] = [
  {
    id: "sample-brgy-qc-a",
    name: "Sample Barangay A (placeholder)",
    level: "barangay",
    parentId: "quezon-city",
    psgcCode: null,
    centroid: null,
    provenance,
  },
];

export const SAMPLE_GEOGRAPHIES: GeographicEntity[] = [
  ...HIGHER_LEVELS,
  ...MUNICIPAL,
  ...PLACEHOLDER_BARANGAYS,
];
