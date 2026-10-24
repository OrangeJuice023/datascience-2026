#!/usr/bin/env node
/**
 * Builds the ACCESS reference data from real, pinned sources: where care and
 * medicine can be found (health facilities and pharmacies from OpenStreetMap,
 * via HOT on HDX) and what dengue medicines cost the public sector (DOH Drug
 * Price Reference Index), per HDX dengue reporting unit.
 *
 *     node scripts/access/fetch-sources.mjs && node scripts/access/build-access.mjs
 *
 * Inputs
 *     data/raw/access/**                          pinned downloads (git-ignored; see sources.json)
 *     data/reference/access/dengue_medicines.csv  curated medicine list and formulary status
 *     data/reference/geo/hdx_dengue_crosswalk.csv reporting units and their COD-AB codes
 *     web/public/geo/hdx-reporting-units.geojson  unit boundaries (cross-check)
 *     web/public/data/sigma/hdx-dengue-sigma.json weekly reported cases (dengue burden)
 * Outputs (generated; do not edit by hand)
 *     web/src/data/access/access-reference.json   per-unit counts, medicines, sources, limits
 *     web/public/data/access/facilities.json      facility points for the map (ODbL)
 *
 * What this does not do, because no public source exists: medicine stock or
 * availability at any facility, and what people search for. Those stay
 * unknown in every output, never zero.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCsvRecords } from "../geo/lib/csv.mjs";
import { readZip } from "../geo/lib/xlsx.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const RAW = path.join(root, "data/raw/access");
const OUT_REFERENCE = path.join(root, "web/src/data/access/access-reference.json");
const OUT_POINTS = path.join(root, "web/public/data/access/facilities.json");

const { sources } = JSON.parse(fs.readFileSync(path.join(here, "sources.json"), "utf8"));
// The dengue counts come from the geography track's pinned HDX download.
const hdxPin = JSON.parse(fs.readFileSync(path.join(root, "scripts/geo/sources.json"), "utf8")).sources.find(
  (s) => s.id === "hdx-doh-epi-dengue",
);
const source = (id) => sources.find((s) => s.id === id);
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

function readPinned(id) {
  const src = source(id);
  const file = path.join(RAW, src.dir, src.file);
  if (!fs.existsSync(file)) throw new Error(`${rel(file)} is missing; run scripts/access/fetch-sources.mjs`);
  const buf = fs.readFileSync(file);
  const hash = sha256(buf);
  if (hash !== src.sha256) {
    throw new Error(`${src.id}: SHA-256 ${hash} does not match sources.json; upstream changed. Check it, then re-pin.`);
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Reporting units
// ---------------------------------------------------------------------------
const crosswalk = readCsvRecords(path.join(root, "data/reference/geo/hdx_dengue_crosswalk.csv"));
const adm3Unit = new Map();
const adm2Unit = new Map();
for (const row of crosswalk) {
  for (const code of row.cod_ab_pcodes.split(";").filter(Boolean)) {
    (row.cod_ab_level === "adm3" ? adm3Unit : adm2Unit).set(code, row.unit_id);
  }
}
const unitIds = crosswalk.map((r) => r.unit_id);
const unitIndex = new Map(unitIds.map((id, i) => [id, i]));

const boundaries = JSON.parse(fs.readFileSync(path.join(root, "web/public/geo/hdx-reporting-units.geojson"), "utf8"));
const shapes = boundaries.features.map((f) => ({
  id: f.properties.id,
  polygons: f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates,
}));
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const unitAtPoint = (pt) =>
  shapes.find((s) => s.polygons.some(([outer, ...holes]) => inRing(pt, outer) && !holes.some((h) => inRing(pt, h))))?.id ?? null;

// ---------------------------------------------------------------------------
// Facilities (HOT OpenStreetMap export)
// ---------------------------------------------------------------------------
const TYPES = ["hospital", "clinic", "pharmacy", "laboratory"];
const CLINIC_AMENITY = new Set(["clinic", "doctors", "health_post"]);
const CLINIC_HEALTHCARE = new Set(["clinic", "doctor", "centre", "birthing_centre", "midwife", "community_health_worker", "health_aide", "nurse"]);

/** The ACCESS type for an OSM feature, or null for places outside dengue care (dentists, vets…). */
function facilityType(p) {
  const amenity = p.amenity ?? "";
  const healthcare = (p.healthcare ?? "").split(";")[0];
  if (amenity === "hospital" || healthcare === "hospital") return "hospital";
  if (amenity === "pharmacy" || healthcare === "pharmacy") return "pharmacy";
  if (amenity === "laboratory" || healthcare === "laboratory") return "laboratory";
  if (CLINIC_AMENITY.has(amenity) || CLINIC_HEALTHCARE.has(healthcare)) return "clinic";
  return null;
}

/** A representative point: the point itself, or the mean of a shape's outer ring. */
function representativePoint(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point") return geometry.coordinates;
  const ring =
    geometry.type === "Polygon"
      ? geometry.coordinates[0]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates[0][0]
        : geometry.type === "LineString"
          ? geometry.coordinates
          : null;
  if (!ring?.length) return null;
  const n = ring.length;
  return [ring.reduce((s, c) => s + c[0], 0) / n, ring.reduce((s, c) => s + c[1], 0) / n];
}

const zip = readZip(readPinned("hotosm-phl-health-facilities"));
const geojsonName = ["health_facilities.geojson", "hotosm_phl_health_facilities_osm.geojson"].find((n) => zip.has(n));
if (!geojsonName) throw new Error("The HOT export has no health_facilities.geojson entry");
const osm = JSON.parse(zip.text(geojsonName));

const counts = { features: osm.features.length, excludedType: 0, noLocation: 0, duplicates: 0, unassigned: 0 };
let crossChecked = 0;
let crossAgreed = 0;
const facilities = [];
const seen = new Map(); // type|name → kept points, for de-duplication
const R = 6371000;
const metres = ([a, b], [c, d]) => {
  const dLat = ((d - b) * Math.PI) / 180;
  const dLon = ((c - a) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((b * Math.PI) / 180) * Math.cos((d * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

for (const f of osm.features) {
  const p = f.properties ?? {};
  const type = facilityType(p);
  if (!type) {
    counts.excludedType++;
    continue;
  }
  const point = representativePoint(f.geometry);
  if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    counts.noLocation++;
    continue;
  }
  // The same place is often mapped twice in OSM (a node and a building): same
  // type, same name and within 50 m is kept once.
  const name = (p.name ?? "").trim();
  if (name) {
    const key = `${type}|${name.toLowerCase().replace(/\s+/g, " ")}`;
    const near = seen.get(key) ?? [];
    if (near.some((q) => metres(q, point) <= 50)) {
      counts.duplicates++;
      continue;
    }
    near.push(point);
    seen.set(key, near);
  }
  // Assignment by COD-AB code (a city unit first, then its province unit);
  // the reporting-unit polygons are the fallback and the cross-check.
  const byCode = adm3Unit.get(p.adm3_pcode) ?? adm2Unit.get(p.adm2_pcode) ?? null;
  const byShape = unitAtPoint(point);
  if (byCode && byShape) {
    crossChecked++;
    if (byCode === byShape) crossAgreed++;
  }
  const unit = byCode ?? byShape;
  if (!unit) {
    counts.unassigned++;
    continue;
  }
  facilities.push({
    osmId: f.id ?? p.id ?? null,
    name: name || null,
    type,
    operator: p.operator_type ?? null,
    unit,
    lon: Math.round(point[0] * 1e5) / 1e5,
    lat: Math.round(point[1] * 1e5) / 1e5,
  });
}

// ---------------------------------------------------------------------------
// Dengue burden per unit (reported cases in usable weeks only)
// ---------------------------------------------------------------------------
const sigma = JSON.parse(fs.readFileSync(path.join(root, "web/public/data/sigma/hdx-dengue-sigma.json"), "utf8"));
const OK = sigma.meta.codes.quality.indexOf("ok");
const YEARS = [2016, 2017, 2018, 2019, 2020];
const burden = new Map(
  sigma.units.map((u) => {
    const byYear = YEARS.map((year) => {
      let cases = 0;
      let usable = 0;
      let weeks = 0;
      sigma.meta.weeks.forEach((w, i) => {
        // Epi (MMWR) year: the year that holds the week's Wednesday, as Lab and the DOH thresholds use.
        if (new Date(Date.parse(w) + 3 * 86_400_000).getUTCFullYear() !== year) return;
        weeks++;
        if (u.quality[i] === OK && u.value[i] !== null) {
          usable++;
          cases += u.value[i];
        }
      });
      return { year, reportedCases: cases, usableWeeks: usable, weeks };
    });
    return [u.id, byYear];
  }),
);

// ---------------------------------------------------------------------------
// Medicines (DOH DPRI dashboard + curated formulary table)
// ---------------------------------------------------------------------------
const dashboard = readPinned("doh-dpri-dashboard").toString("utf8");
function embeddedJson(marker) {
  const start = dashboard.indexOf(marker);
  if (start < 0) throw new Error(`DPRI dashboard: ${marker} not found; the page layout changed`);
  let i = dashboard.indexOf("{", start);
  let depth = 0;
  let inString = false;
  for (let j = i; j < dashboard.length; j++) {
    const ch = dashboard[j];
    if (inString) {
      if (ch === "\\") j++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(dashboard.slice(i, j + 1));
  }
  throw new Error(`DPRI dashboard: ${marker} is not complete JSON`);
}
const BASE = embeddedJson("const BASE = ");
const OVERRIDES = embeddedJson("const OVERRIDES = ");
const hiddenItems = new Set(OVERRIDES.HIDDEN ?? []);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round2 = (x) => Math.round(x * 100) / 100;

const medicines = readCsvRecords(path.join(root, "data/reference/access/dengue_medicines.csv")).map((m) => {
  const items = m.dpri_items.split("|").map((key) => {
    if (hiddenItems.has(key)) return { item: key, status: "hidden by DOH in the public view" };
    const entry = BASE[key];
    if (!entry) return { item: key, status: "not in this DPRI edition" };
    const hiddenRows = new Set((OVERRIDES.HIDDEN_FAC ?? {})[key] ?? []);
    const prices = entry.facilities
      .filter((r) => !hiddenRows.has(r.f) && Number.isFinite(Number(r.p)) && Number(r.p) > 0)
      .map((r) => Number(r.p));
    if (prices.length === 0) return { item: key, status: "no public price rows" };
    return {
      item: key,
      status: "priced",
      lowestPhp: round2(Math.min(...prices)),
      medianPhp: round2(median(prices)),
      highestPhp: round2(Math.max(...prices)),
      reportingFacilities: prices.length,
    };
  });
  return {
    id: m.medicine_id,
    name: m.name,
    role: m.role_in_dengue_care,
    onPnfEml: m.on_pnf_eml === "yes",
    pnfPage: m.pnf_page || null,
    basis: m.basis,
    items,
  };
});

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
const hot = source("hotosm-phl-health-facilities");
const dpri = source("doh-dpri-dashboard");
const units = crosswalk.map((row) => {
  const here = facilities.filter((f) => f.unit === row.unit_id);
  const byType = Object.fromEntries(TYPES.map((t) => [t, here.filter((f) => f.type === t).length]));
  const area = Number(row.area_sqkm);
  return {
    id: row.unit_id,
    name: row.unit_name,
    unitType: row.unit_type,
    regionId: row.analysis_region_id,
    psgcCode: row.psa_psgc_codes.split(";")[0] || null,
    areaSqKm: Number.isFinite(area) && area > 0 ? area : null,
    mappedFacilities: byType,
    mappedPer100SqKm:
      Number.isFinite(area) && area > 0
        ? Object.fromEntries(TYPES.map((t) => [t, round2((byType[t] / area) * 100)]))
        : null,
    population: null,
    dengue: burden.get(row.unit_id) ?? null,
  };
});

const reference = {
  meta: {
    generator: "scripts/access/build-access.mjs",
    isSample: false,
    question: "Can people in an area reach care and dengue medicines, and what do those medicines cost the public sector?",
    facilityTypes: TYPES,
    sources: [
      {
        id: hot.id,
        title: hot.title,
        publisher: hot.publisher,
        url: hot.datasetUrl,
        license: hot.license,
        attribution: hot.attribution,
        snapshot: hot.upstreamModified,
        sha256: hot.sha256,
      },
      {
        id: dpri.id,
        title: dpri.title,
        publisher: dpri.publisher,
        url: dpri.datasetUrl,
        license: dpri.license,
        attribution: dpri.attribution,
        edition: dpri.edition,
        sha256: dpri.sha256,
      },
      {
        id: "hdx-doh-dengue",
        title: "HDX Philippine Dengue Cases and Deaths (DOH-Epi, 2016-2021)",
        publisher: "Cirrolytix via HDX; data attributed to the DOH Epidemiology Bureau",
        url: "https://data.humdata.org/dataset/philippine-dengue-cases-and-deaths",
        license: "CC BY",
        attribution: "Cirrolytix via HDX; DOH Epidemiology Bureau",
        sha256: hdxPin?.sha256 ?? null,
      },
    ],
    facilityCounts: {
      ...counts,
      kept: facilities.length,
      assignmentCrossCheck: { checked: crossChecked, agreed: crossAgreed },
    },
    limitations: [
      "Facility counts are places mapped in OpenStreetMap (snapshot " + hot.upstreamModified + "). Mapping completeness varies; a low count can mean low mapping, not low access. Barangay health stations are badly under-mapped (about 1,555 health posts in OSM against 27,286 BHS in the DOH registry).",
      "Prices are what DOH hospitals paid in 2025 procurement (2026 interim DPRI), not shelf prices at private pharmacies.",
      "No public source reports medicine stock, stock-outs or availability at any facility, or what people search for; those indicators are unknown, never zero.",
      "Population by reporting unit is not in the repository yet, so per-person rates are not computed. Density per 100 km² uses each unit's mapped area.",
      "Dengue burden is reported cases in 2016-2020 (usable weeks only); facility counts describe 2026. They come from different years.",
      "Dengue rapid tests (NS1/IgG/IgM) have no public price source and are not on the PNF medicines list.",
    ],
    unavailable: {
      availability: "No public per-facility stock data in the Philippines (EDPMS is login-only).",
      searchDemand: "SIGMA collects no search data, and no public source exists.",
      population: "City and province-remainder population is not in the repository.",
    },
  },
  units,
  medicines,
};

const points = {
  meta: {
    generator: "scripts/access/build-access.mjs",
    license: "ODbL 1.0",
    attribution: hot.attribution,
    source: hot.datasetUrl,
    snapshot: hot.upstreamModified,
    columns: ["lon", "lat", "type", "unit", "name"],
    types: TYPES,
    units: unitIds,
  },
  points: facilities.map((f) => [f.lon, f.lat, TYPES.indexOf(f.type), unitIndex.get(f.unit), f.name]),
};

for (const [file, data] of [
  [OUT_REFERENCE, reference],
  [OUT_POINTS, points],
]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data) + "\n");
}

const totals = Object.fromEntries(TYPES.map((t) => [t, facilities.filter((f) => f.type === t).length]));
console.log(
  `facilities kept ${facilities.length} of ${counts.features} (${JSON.stringify(totals)}); ` +
    `excluded type ${counts.excludedType}, duplicates ${counts.duplicates}, no location ${counts.noLocation}, unassigned ${counts.unassigned}; ` +
    `code vs polygon agreement ${crossAgreed}/${crossChecked}`,
);
console.log(
  `medicines: ${medicines.map((m) => `${m.id} ${m.items.filter((i) => i.status === "priced").length}/${m.items.length} priced`).join(", ")}`,
);
console.log(`→ ${rel(OUT_REFERENCE)} (${fs.statSync(OUT_REFERENCE).size} B), ${rel(OUT_POINTS)} (${fs.statSync(OUT_POINTS).size} B)`);
