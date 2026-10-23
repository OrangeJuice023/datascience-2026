#!/usr/bin/env node
/**
 * SIGMA geography track: simplified polygons for the 126 HDX dengue reporting units.
 *
 *   node scripts/geo/fetch-sources.mjs     # once: download + verify raw inputs
 *   node scripts/geo/build-geo.mjs         # writes the crosswalk and admin_reference.csv
 *   node scripts/geo/build-boundaries.mjs  # this script
 *
 * Inputs (read-only)
 *   data/raw/geoboundaries_phl/geoBoundaries-PHL-ADM3_simplified.geojson  (geoBoundaries gbOpen, CC BY 3.0 IGO)
 *   data/processed/geo/admin_reference.csv      COD-AB v03 admin-3 centres (written by build-geo.mjs)
 *   data/reference/geo/hdx_dengue_crosswalk.csv reporting unit → COD-AB codes
 *   scripts/geo/sources.json                    expected input hash
 *
 * Output
 *   web/public/geo/hdx-reporting-units.geojson  one (Multi)Polygon per reporting unit (committed, generated)
 *
 * Method
 *   1. geoBoundaries ADM3 has names but no P-codes, so each polygon gets the COD-AB admin-3 units
 *      whose centre falls inside it (point in polygon). A polygon with no centre takes the nearest one.
 *   2. Each admin-3 unit belongs to exactly one reporting unit (city codes first, then the province).
 *   3. Polygons of one unit are dissolved by cancelling the edges they share.
 *   4. Borders are simplified per arc (between junctions), so two neighbouring units keep the
 *      same shared line and no gaps or overlaps appear between them.
 *
 * Geometry is for display only: signal-status fills and selection. It never carries case values.
 * Exits non-zero if the input hash differs, a reporting unit gets no polygon, or a polygon holds
 * centres of more than one reporting unit that its name cannot settle.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCsvRecords } from "./lib/csv.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const p = (rel) => path.join(ROOT, rel);

const SOURCE_ID = "geoboundaries-phl-adm3";
/** Douglas–Peucker tolerance in degrees (~200 m); fine for province-level display. */
const TOLERANCE = 0.002;
const DECIMALS = 4;
const OUT = "web/public/geo/hdx-reporting-units.geojson";

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
};

// ---------------------------------------------------------------- inputs
const { sources } = JSON.parse(fs.readFileSync(p("scripts/geo/sources.json"), "utf8"));
const source = sources.find((s) => s.id === SOURCE_ID);
const gbPath = p(path.posix.join("data/raw", source.dir, source.file));
if (!fs.existsSync(gbPath)) {
  console.error(`✗ ${path.relative(ROOT, gbPath)} missing: run node scripts/geo/fetch-sources.mjs`);
  process.exit(1);
}
const gbBuffer = fs.readFileSync(gbPath);
const gbHash = crypto.createHash("sha256").update(gbBuffer).digest("hex");
if (gbHash !== source.sha256) {
  console.error(`✗ ${SOURCE_ID}: SHA-256 ${gbHash} does not match sources.json (${source.sha256}). Upstream changed?`);
  process.exit(1);
}
const gb = JSON.parse(gbBuffer.toString("utf8"));

const adminPath = p("data/processed/geo/admin_reference.csv");
if (!fs.existsSync(adminPath)) {
  console.error("✗ data/processed/geo/admin_reference.csv missing: run node scripts/geo/build-geo.mjs first");
  process.exit(1);
}
const adm3 = readCsvRecords(adminPath).filter((r) => r.level === "3");
const crosswalk = readCsvRecords(p("data/reference/geo/hdx_dengue_crosswalk.csv"));

// ---------------------------------------------------------------- admin-3 → reporting unit
const units = new Map();
const byAdm3 = new Map();
const byAdm2 = new Map();
for (const r of crosswalk) {
  units.set(r.unit_id, { id: r.unit_id, name: r.unit_name, unitType: r.unit_type, regionId: r.analysis_region_id });
  for (const code of r.cod_ab_pcodes.split(";")) (r.cod_ab_level === "adm3" ? byAdm3 : byAdm2).set(code, r.unit_id);
}
for (const r of adm3) {
  r.unit = byAdm3.get(r.pcode) ?? byAdm2.get(r.adm2_pcode);
  if (!r.unit) fail(`admin-3 ${r.pcode} ${r.name} has no reporting unit`);
  r.x = Number(r.center_lon);
  r.y = Number(r.center_lat);
}

// ---------------------------------------------------------------- geometry helpers
const polygonsOf = (geom) => (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates);

function ringArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const inPolygon = (x, y, poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((hole) => inRing(x, y, hole));

/** Approximate area in km² (equirectangular at the ring's latitude). */
function ringKm2(ring) {
  const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  return Math.abs(ringArea(ring)) * 111.32 * 111.32 * Math.cos((lat * Math.PI) / 180);
}

// ---------------------------------------------------------------- 1. geoBoundaries polygon → admin-3 centres
const features = gb.features.map((f, index) => {
  const polys = polygonsOf(f.geometry);
  const xs = polys.flatMap((poly) => poly[0].map((c) => c[0]));
  const ys = polys.flatMap((poly) => poly[0].map((c) => c[1]));
  return {
    index,
    name: f.properties.shapeName,
    polys,
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    centres: [],
  };
});

let centresOutside = 0;
for (const r of adm3) {
  const hit = features.find(
    (f) =>
      r.x >= f.bbox[0] && r.x <= f.bbox[2] && r.y >= f.bbox[1] && r.y <= f.bbox[3] &&
      f.polys.some((poly) => inPolygon(r.x, r.y, poly)),
  );
  if (hit) hit.centres.push(r);
  else centresOutside++;
}

const normName = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)|city of|city/g, "").replace(/[^a-z]/g, "");

const assignment = { single: 0, nearest: 0, byName: 0, byMajority: 0 };
const conflicts = [];
for (const f of features) {
  const unitIds = [...new Set(f.centres.map((r) => r.unit))];
  if (unitIds.length === 1) {
    f.unit = unitIds[0];
    assignment.single++;
  } else if (unitIds.length === 0) {
    // Centre of the polygon's largest ring → nearest COD-AB centre.
    const ring = f.polys.map((poly) => poly[0]).sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0];
    const cx = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    const cy = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    let best = null;
    for (const r of adm3) {
      const d = (r.x - cx) ** 2 + (r.y - cy) ** 2;
      if (!best || d < best.d) best = { r, d };
    }
    f.unit = best.r.unit;
    assignment.nearest++;
  } else {
    // Several reporting units inside one 2020 polygon: settle by the polygon's own name.
    const named = f.centres.filter((r) => normName(r.name) === normName(f.name));
    const namedUnits = [...new Set(named.map((r) => r.unit))];
    if (namedUnits.length === 1) {
      f.unit = namedUnits[0];
      assignment.byName++;
    } else {
      const counts = new Map();
      for (const r of f.centres) counts.set(r.unit, (counts.get(r.unit) ?? 0) + 1);
      const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      f.unit = ranked[0][0];
      assignment.byMajority++;
    }
    conflicts.push({ name: f.name, units: unitIds, chosen: f.unit });
  }
}

const polysByUnit = new Map([...units.keys()].map((id) => [id, []]));
for (const f of features) polysByUnit.get(f.unit).push(...f.polys);
for (const [id, polys] of polysByUnit) if (polys.length === 0) fail(`reporting unit ${id} has no polygon`);

// ---------------------------------------------------------------- 3. dissolve by shared-edge cancellation
const key = (c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`;

function dissolve(polys) {
  const edges = new Map(); // "a|b" → [a, b] (directed)
  const add = (a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === kb) return;
    const reverse = `${kb}|${ka}`;
    if (edges.has(reverse)) edges.delete(reverse);
    else edges.set(`${ka}|${kb}`, [a, b]);
  };
  for (const poly of polys) {
    poly.forEach((ring, i) => {
      // Outer rings counter-clockwise, holes clockwise, so shared edges run opposite ways.
      const ccw = ringArea(ring) > 0;
      const r = (i === 0) === ccw ? ring : [...ring].reverse();
      for (let k = 0; k < r.length - 1; k++) add(r[k], r[k + 1]);
    });
  }
  const outgoing = new Map();
  for (const [k, e] of [...edges].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const start = k.split("|")[0];
    if (!outgoing.has(start)) outgoing.set(start, []);
    outgoing.get(start).push(e);
  }
  const rings = [];
  for (const [start] of outgoing) {
    while (outgoing.get(start).length) {
      const ring = [];
      let e = outgoing.get(start).shift();
      ring.push(e[0]);
      while (true) {
        ring.push(e[1]);
        const next = outgoing.get(key(e[1]));
        if (key(e[1]) === start || !next?.length) break;
        e = next.shift();
      }
      if (ring.length >= 4 && key(ring[0]) === key(ring[ring.length - 1])) rings.push(ring);
    }
  }
  return rings;
}

function toPolygons(rings) {
  const outers = rings.filter((r) => ringArea(r) > 0).map((r) => [r]);
  const holes = rings.filter((r) => ringArea(r) < 0);
  for (const hole of holes) {
    const [hx, hy] = hole[0];
    const owner = outers
      .filter((poly) => inRing(hx, hy, poly[0]))
      .sort((a, b) => Math.abs(ringArea(a[0])) - Math.abs(ringArea(b[0])))[0];
    if (owner) owner.push(hole);
  }
  return outers;
}

const dissolved = new Map();
for (const [id, polys] of polysByUnit) dissolved.set(id, dissolve(polys));

// ---------------------------------------------------------------- 4. topology-preserving simplification
const neighbours = new Map();
for (const rings of dissolved.values()) {
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = key(ring[i]);
      const b = key(ring[i + 1]);
      if (!neighbours.has(a)) neighbours.set(a, new Set());
      if (!neighbours.has(b)) neighbours.set(b, new Set());
      neighbours.get(a).add(b);
      neighbours.get(b).add(a);
    }
  }
}
const isJunction = (c) => neighbours.get(key(c)).size >= 3;

function douglasPeucker(points) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [x1, y1] = points[s];
    const [x2, y2] = points[e];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    let max = 0;
    let at = -1;
    for (let i = s + 1; i < e; i++) {
      const [x, y] = points[i];
      const d = len === 0 ? Math.hypot(x - x1, y - y1) : Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
      if (d > max) {
        max = d;
        at = i;
      }
    }
    if (max > TOLERANCE) {
      keep[at] = 1;
      stack.push([s, at], [at, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplify an open arc identically whichever way it is traversed. */
function simplifyArc(arc) {
  const ka = key(arc[0]);
  const kb = key(arc[arc.length - 1]);
  const flip = ka > kb || (ka === kb && key(arc[1]) > key(arc[arc.length - 2]));
  const canonical = flip ? [...arc].reverse() : arc;
  const out = douglasPeucker(canonical);
  return flip ? out.reverse() : out;
}

function simplifyRing(ring) {
  const open = ring.slice(0, -1);
  let starts = open.map((c, i) => (isJunction(c) ? i : -1)).filter((i) => i >= 0);
  if (starts.length === 0) {
    // No junction (island, or a unit enclosed by one other): start at the smallest key, and
    // split at the opposite vertex so both traversal directions give the same result.
    let min = 0;
    open.forEach((c, i) => {
      if (key(c) < key(open[min])) min = i;
    });
    starts = [min, (min + Math.floor(open.length / 2)) % open.length];
  }
  const out = [];
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s];
    const to = starts[(s + 1) % starts.length];
    const arc = [];
    for (let i = from; ; i = (i + 1) % open.length) {
      arc.push(open[i]);
      if (i === to && arc.length > 1) break;
    }
    const simple = simplifyArc(arc);
    out.push(...simple.slice(0, -1));
  }
  out.push(out[0]);
  return out;
}

const round = (c) => [Number(c[0].toFixed(DECIMALS)), Number(c[1].toFixed(DECIMALS))];
function clean(ring) {
  const out = [];
  for (const c of ring.map(round)) if (!out.length || key(out[out.length - 1]) !== key(c)) out.push(c);
  return out;
}

// ---------------------------------------------------------------- output
let inVertices = 0;
let outVertices = 0;
let droppedRings = 0;
const areaCheck = [];
const outFeatures = [];
const crosswalkArea = new Map(crosswalk.map((r) => [r.unit_id, Number(r.area_sqkm)]));
for (const [id, unit] of [...units].sort((a, b) => a[0].localeCompare(b[0]))) {
  const rings = [];
  for (const ring of dissolved.get(id)) {
    inVertices += ring.length;
    const simple = clean(simplifyRing(ring));
    if (simple.length < 4 || ringArea(simple) === 0) {
      droppedRings++;
      continue;
    }
    rings.push(simple);
    outVertices += simple.length;
  }
  const polys = toPolygons(rings);
  const km2 = polys.reduce((s, poly) => s + ringKm2(poly[0]) - poly.slice(1).reduce((h, r) => h + ringKm2(r), 0), 0);
  areaCheck.push({ id, ratio: km2 / crosswalkArea.get(id) });
  outFeatures.push({
    type: "Feature",
    id,
    properties: { id, name: unit.name, unitType: unit.unitType, regionId: unit.regionId },
    geometry: polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys },
  });
}

const collection = {
  type: "FeatureCollection",
  metadata: {
    description:
      "Display polygons for the 126 HDX DOH-Epi dengue reporting units (2016–2021). Geography only: no case values. Province remainders exclude their separately reported cities.",
    generator: "scripts/geo/build-boundaries.mjs",
    source: `geoBoundaries gbOpen PHL ADM3 (2020), ${source.url}`,
    license: source.license,
    attribution: source.attribution,
    sha256: gbHash,
    assignment: "COD-AB v03 admin-3 centres → geoBoundaries polygons (point in polygon)",
    simplification: `Douglas–Peucker per shared arc, tolerance ${TOLERANCE}°, ${DECIMALS} decimals`,
  },
  features: outFeatures,
};
fs.mkdirSync(path.dirname(p(OUT)), { recursive: true });
fs.writeFileSync(p(OUT), JSON.stringify(collection) + "\n");

const ratios = areaCheck.map((a) => a.ratio).sort((a, b) => a - b);
const worst = areaCheck.filter((a) => a.ratio < 0.8 || a.ratio > 1.25);
console.log(`geoBoundaries polygons: ${features.length}; COD-AB admin-3 centres: ${adm3.length} (${centresOutside} outside every polygon)`);
console.log(`polygon → unit: ${assignment.single} single, ${assignment.nearest} nearest centre, ${assignment.byName} by name, ${assignment.byMajority} by majority`);
for (const c of conflicts) console.log(`  shared polygon ${c.name}: ${c.units.join(", ")} → ${c.chosen}`);
console.log(`vertices: ${inVertices} dissolved → ${outVertices} simplified; ${droppedRings} tiny rings dropped`);
console.log(`area vs COD-AB: median ${ratios[Math.floor(ratios.length / 2)].toFixed(3)}, range ${ratios[0].toFixed(3)}–${ratios[ratios.length - 1].toFixed(3)}`);
for (const w of worst) console.log(`  area ratio ${w.ratio.toFixed(3)}: ${w.id}`);
if (assignment.byMajority > 0) fail(`${assignment.byMajority} polygon(s) settled by majority; review the list above`);
console.log(`→ ${OUT} (${(fs.statSync(p(OUT)).size / 1024).toFixed(0)} KB)`);
