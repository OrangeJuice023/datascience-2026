#!/usr/bin/env node
/**
 * Builds the landing page's 8-bit map: the 126 HDX dengue reporting units
 * rasterised onto a coarse pixel grid, with each unit's EARS state for every
 * week of 2019.
 *
 *     node web/scripts/build-landing-pixels.mjs
 *
 * Inputs (both committed, both generated upstream; see AGENTS.md §5)
 *     web/public/geo/hdx-reporting-units.geojson   unit boundaries
 *     web/public/data/sigma/hdx-dengue-sigma.json  weekly EARS results
 * Output (generated; do not edit by hand)
 *     web/src/data/landing/pixel-map.json
 *
 * A pixel belongs to the unit whose boundary contains the pixel's centre.
 * A unit too small to contain any centre gets the pixel under its
 * representative point, so every unit is drawn. Week states:
 *   0 no data (missing or suspect-swap week), 1 not computed, 2 no alarm,
 *   3 EARS alarm (C1, C2 or C3). Nothing is interpolated or zero-filled.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const GEO = join(WEB, "public/geo/hdx-reporting-units.geojson");
const SIGMA = join(WEB, "public/data/sigma/hdx-dengue-sigma.json");
const OUT = join(WEB, "src/data/landing/pixel-map.json");

const YEAR = "2019";
const COLS = 44;
// Longitude/latitude box around the Philippines; rows follow from the cell size.
const BOX = { west: 116.8, east: 126.8, south: 4.4, north: 21.2 };
const CELL = (BOX.east - BOX.west) / COLS;
const ROWS = Math.ceil((BOX.north - BOX.south) / CELL);

const geo = JSON.parse(readFileSync(GEO, "utf8"));
const sigma = JSON.parse(readFileSync(SIGMA, "utf8"));

function rings(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  throw new Error(`unsupported geometry ${geometry.type}`);
}

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygons(point, polygons) {
  return polygons.some(([outer, ...holes]) => inRing(point, outer) && !holes.some((h) => inRing(point, h)));
}

const unitIndex = new Map(sigma.units.map((u, i) => [u.id, i]));
const shapes = geo.features.map((f) => {
  const index = unitIndex.get(f.properties.id);
  if (index === undefined) throw new Error(`boundary ${f.properties.id} has no SIGMA results`);
  return { index, polygons: rings(f.geometry) };
});

const grid = new Map(); // "row,col" -> unit index
for (let row = 0; row < ROWS; row++) {
  const lat = BOX.north - (row + 0.5) * CELL;
  for (let col = 0; col < COLS; col++) {
    const lon = BOX.west + (col + 0.5) * CELL;
    const hit = shapes.find((s) => inPolygons([lon, lat], s.polygons));
    if (hit) grid.set(`${row},${col}`, hit.index);
  }
}
const drawn = new Set(grid.values());
for (const [i, unit] of sigma.units.entries()) {
  if (drawn.has(i)) continue;
  const [lon, lat] = unit.point;
  const row = Math.floor((BOX.north - lat) / CELL);
  const col = Math.floor((lon - BOX.west) / CELL);
  grid.set(`${row},${col}`, i); // a small unit takes the pixel under its point
}

const codes = sigma.meta.codes;
const OK = codes.quality.indexOf("ok");
const NOT_COMPUTED = codes.ears.indexOf("not computed");
const NONE = codes.ears.indexOf("none");
const weekIdx = sigma.meta.weeks.flatMap((w, i) => (w.startsWith(YEAR) ? [i] : []));

const states = weekIdx.map((wi) =>
  sigma.units
    .map((u) => {
      if (u.quality[wi] !== OK || u.ears[wi] === null) return 0;
      if (u.ears[wi] === NOT_COMPUTED) return 1;
      if (u.ears[wi] === NONE) return 2;
      return 3;
    })
    .join(""),
);

const out = {
  meta: {
    generator: "web/scripts/build-landing-pixels.mjs",
    inputs: ["web/public/geo/hdx-reporting-units.geojson", "web/public/data/sigma/hdx-dengue-sigma.json"],
    source: sigma.meta.source,
    isSample: false,
    year: Number(YEAR),
    cols: COLS,
    rows: ROWS,
    states: ["no data", "not computed", "no alarm", "EARS alarm"],
    note: "Retrospective EARS results per reporting unit; not a forecast and not a measure of risk.",
  },
  names: sigma.units.map((u) => u.name),
  weeks: weekIdx.map((wi) => sigma.meta.weeks[wi]),
  cells: [...grid.entries()].map(([key, unit]) => [...key.split(",").map(Number), unit]),
  states,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out) + "\n");
const alarms = states.map((s) => [...s].filter((c) => c === "3").length);
console.log(
  `${out.cells.length} pixels for ${sigma.units.length} units on ${COLS}x${ROWS}; ` +
    `${out.weeks.length} weeks of ${YEAR}; alarmed units per week ${Math.min(...alarms)}-${Math.max(...alarms)}`,
);
