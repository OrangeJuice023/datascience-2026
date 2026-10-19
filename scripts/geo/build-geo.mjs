#!/usr/bin/env node
/**
 * SIGMA geography track: HDX DOH-Epi dengue (2016–2021) → canonical geography.
 *
 *   node scripts/geo/fetch-sources.mjs   # once: download + verify raw inputs
 *   node scripts/geo/build-geo.mjs       # deterministic rebuild of every output
 *
 * Inputs (read-only)
 *   data/raw/hdx_dengue/doh-epi-dengue-data-2016-2021.csv
 *   data/raw/cod_ab_phl/phl_admin_boundaries.xlsx          (COD-AB v03, admin 1–3)
 *   data/raw/cod_ps_phl/phl_admpop_adm2_2022_v2.csv        (pcode-compatibility check only)
 *   data/raw/geo-sources-manifest.json                     (hashes, retrieval dates)
 *   data/reference/geo/{source_region_labels,name_overrides,city_classes}.csv  (curated, logged decisions)
 *   web/src/data/opendengue-ph.json                        (national cross-check only; never merged)
 *
 * Outputs
 *   data/reference/geo/hdx_dengue_crosswalk.csv   source identifier → canonical reporting unit (committed)
 *   data/reference/geo/geography_hub_rows.csv     rows for the master data hub GEOGRAPHY tab (committed)
 *   data/processed/geo/admin_reference.csv        COD-AB admin 1–3 flattened (not committed)
 *   data/processed/geo/hdx_unit_year_coverage.csv weeks reported per unit and year (not committed)
 *   docs/geo/geo-data-quality-report.md           generated data-quality report (committed)
 *   web/src/data/geo/hdx-reporting-units.json     frontend fixture: entities + aggregation map (committed)
 *
 * The script exits non-zero if any hard invariant fails (unmatched or ambiguous
 * identifiers, admin-3 units not partitioned exactly once, curated parents that
 * disagree with COD-AB, unexpected input hashes). Case counts are read only for
 * coverage and consistency checks; this script never writes case values.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCsvRecords, writeCsv } from "./lib/csv.mjs";
import { readWorkbook, toRecords } from "./lib/xlsx.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const p = (...parts) => path.join(ROOT, ...parts);
const GENERATOR = "scripts/geo/build-geo.mjs";
const PIPELINE_VERSION = "geo-1.0.0";

const errors = [];
const fail = (msg) => errors.push(msg);

// ---------------------------------------------------------------------------
// Inputs and provenance
// ---------------------------------------------------------------------------

const { sources } = JSON.parse(fs.readFileSync(p("scripts/geo/sources.json"), "utf8"));
const manifestFile = p("data/raw/geo-sources-manifest.json");
if (!fs.existsSync(manifestFile)) {
  console.error("Missing data/raw/geo-sources-manifest.json — run node scripts/geo/fetch-sources.mjs first.");
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
for (const src of sources) {
  const file = p("data/raw", src.dir, src.file);
  if (!fs.existsSync(file)) {
    fail(`Missing raw input ${src.id} (${file}); run fetch-sources.mjs`);
    continue;
  }
  const hash = sha256(file);
  if (src.sha256 && hash !== src.sha256) fail(`${src.id}: SHA-256 ${hash} ≠ sources.json ${src.sha256}`);
}
if (errors.length) finish();

const DENGUE_FILE = p("data/raw/hdx_dengue/doh-epi-dengue-data-2016-2021.csv");
const CODAB_FILE = p("data/raw/cod_ab_phl/phl_admin_boundaries.xlsx");
const CODPS_ADM2_FILE = p("data/raw/cod_ps_phl/phl_admpop_adm2_2022_v2.csv");

const regionLabels = readCsvRecords(p("data/reference/geo/source_region_labels.csv"));
const overrides = new Map(readCsvRecords(p("data/reference/geo/name_overrides.csv")).map((r) => [r.source_loc, r]));
const cityClasses = new Map(readCsvRecords(p("data/reference/geo/city_classes.csv")).map((r) => [r.source_loc_clean, r]));
const regionByLabel = new Map(regionLabels.map((r) => [r.source_region_label, r]));
const regionById = new Map(regionLabels.map((r) => [r.region_pcode, r]));

// ---------------------------------------------------------------------------
// Name handling
// ---------------------------------------------------------------------------

const stripDiacritics = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s) => stripDiacritics(s).toUpperCase().replace(/\s+/g, " ").trim();
const cityOf = (s) => s.replace(/^(?:[A-Z ]*\b)?CITY OF (.+)$/, "$1 CITY");
const slug = (s) =>
  stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const PAREN_STOP = new Set(["CAPITAL", "NOT A PROVINCE", "POB."]);

/** Match keys for a COD-AB name: the base name and any informative parenthetical alias. */
function nameKeys(name) {
  const keys = [];
  const base = norm(name.replace(/\([^)]*\)/g, ""));
  keys.push({ key: cityOf(base), via: "base" });
  for (const m of name.matchAll(/\(([^)]*)\)/g)) {
    const alias = norm(m[1]);
    if (!PAREN_STOP.has(alias)) keys.push({ key: cityOf(alias), via: "alias" });
  }
  return keys;
}
const baseName = (name) => name.replace(/\s*\((?:Capital|not a province)\)/gi, "").trim();

// ---------------------------------------------------------------------------
// COD-AB reference
// ---------------------------------------------------------------------------

const wb = readWorkbook(CODAB_FILE, { sheets: ["phl_admin0", "phl_admin1", "phl_admin2", "phl_admin3"] });
const adm0 = toRecords(wb.get("phl_admin0"))[0];
const adm1 = toRecords(wb.get("phl_admin1"));
const adm2 = toRecords(wb.get("phl_admin2"));
const adm3 = toRecords(wb.get("phl_admin3"));
const CODAB_VERSION = adm0.version;
const excelDate = (serial) =>
  serial ? new Date(Date.UTC(1899, 11, 30) + Number(serial) * 864e5).toISOString().slice(0, 10) : null;
const CODAB_VALID_ON = excelDate(adm1[0].valid_on);

const adm2ByPcode = new Map(adm2.map((r) => [r.adm2_pcode, r]));
const adm3ByPcode = new Map(adm3.map((r) => [r.adm3_pcode, r]));
const adm3ByAdm2 = new Map();
for (const r of adm3) {
  if (!adm3ByAdm2.has(r.adm2_pcode)) adm3ByAdm2.set(r.adm2_pcode, []);
  adm3ByAdm2.get(r.adm2_pcode).push(r);
}
function index(records, nameField) {
  const map = new Map();
  for (const r of records)
    for (const { key, via } of nameKeys(r[nameField])) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ record: r, via });
    }
  return map;
}
const adm2Index = index(adm2, "adm2_name");
const adm3Index = index(adm3, "adm3_name");

/** COD-AB pcodes are the PSGC digits; 10-digit PSGC = digits right-padded. Unverified against a PSA publication. */
const psgc10 = (pcode) => pcode.slice(2).padEnd(10, "0");

fs.mkdirSync(p("data/processed/geo"), { recursive: true });
writeCsv(
  p("data/processed/geo/admin_reference.csv"),
  ["level", "pcode", "name", "parent_pcode", "adm1_pcode", "adm1_name", "adm2_pcode", "adm2_name", "area_sqkm", "center_lat", "center_lon", "psgc10_derived", "codab_version"],
  [
    ...adm1.map((r) => ({ level: 1, pcode: r.adm1_pcode, name: r.adm1_name, parent_pcode: "PH", adm1_pcode: r.adm1_pcode, adm1_name: r.adm1_name, area_sqkm: r.area_sqkm, center_lat: r.center_lat, center_lon: r.center_lon })),
    ...adm2.map((r) => ({ level: 2, pcode: r.adm2_pcode, name: r.adm2_name, parent_pcode: r.adm1_pcode, adm1_pcode: r.adm1_pcode, adm1_name: r.adm1_name, adm2_pcode: r.adm2_pcode, adm2_name: r.adm2_name, area_sqkm: r.area_sqkm, center_lat: r.center_lat, center_lon: r.center_lon })),
    ...adm3.map((r) => ({ level: 3, pcode: r.adm3_pcode, name: r.adm3_name, parent_pcode: r.adm2_pcode, adm1_pcode: r.adm1_pcode, adm1_name: r.adm1_name, adm2_pcode: r.adm2_pcode, adm2_name: r.adm2_name, area_sqkm: r.area_sqkm, center_lat: r.center_lat, center_lon: r.center_lon })),
  ].map((r) => ({ ...r, psgc10_derived: psgc10(r.pcode), codab_version: CODAB_VERSION })),
);

// ---------------------------------------------------------------------------
// Dengue file: structure and identifier audit
// ---------------------------------------------------------------------------

const rawText = fs.readFileSync(DENGUE_FILE, "utf8");
const lines = rawText.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l !== "");
const header = lines[0].split(",");
const hxl = lines[1].split(",");
const EXPECTED_HEADER = ["loc", "cases", "deaths", "date", "Region"];
if (header.join() !== EXPECTED_HEADER.join()) fail(`Unexpected header: ${header.join()}`);
if (!hxl[0].startsWith("#")) fail("Second row is not an HXL tag row");
const records = lines.slice(2).map((line, i) => {
  const f = line.split(",");
  return { line: i + 3, fields: f.length, loc: f[0], cases: f[1], deaths: f[2], date: f[3], region: f[4] };
});

const isoFromMdy = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(iso + "T00:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
};
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;

const recordIssues = {
  badFieldCount: records.filter((r) => r.fields !== 5),
  badDate: records.filter((r) => !isoFromMdy(r.date)),
  notSunday: records.filter((r) => isoFromMdy(r.date) && new Date(isoFromMdy(r.date) + "T00:00Z").getUTCDay() !== 0),
  badCases: records.filter((r) => !/^\d+$/.test(r.cases)),
  missingDeaths: records.filter((r) => r.deaths === ""),
  badDeaths: records.filter((r) => r.deaths !== "" && !/^\d+$/.test(r.deaths)),
  deathsExceedCases: records.filter((r) => /^\d+$/.test(r.deaths) && /^\d+$/.test(r.cases) && Number(r.deaths) > Number(r.cases)),
};

/** Identifier-level whitespace/casing findings, keyed by raw string. */
const rawLocs = [...new Set(records.map((r) => r.loc))].sort();
const rawRegions = [...new Set(records.map((r) => r.region))].sort();
const cleanLoc = (s) => s.replace(/\s+/g, " ").trim().toUpperCase();
const locWhitespace = rawLocs.filter((s) => s !== s.trim() || /\s{2,}/.test(s));
const regionCasing = rawRegions.filter((s) => s !== s.toUpperCase());

// Same cleaned name spelled differently in the raw file → would silently split a unit.
const rawByClean = new Map();
for (const s of rawLocs) {
  const c = cleanLoc(s);
  if (!rawByClean.has(c)) rawByClean.set(c, []);
  rawByClean.get(c).push(s);
}
const spellingVariants = [...rawByClean].filter(([, v]) => v.length > 1);

// A location must sit in exactly one source region.
const regionsByLoc = new Map();
for (const r of records) {
  const c = cleanLoc(r.loc);
  if (!regionsByLoc.has(c)) regionsByLoc.set(c, new Set());
  regionsByLoc.get(c).add(r.region);
}
const multiRegionLocs = [...regionsByLoc].filter(([, s]) => s.size > 1);
for (const [loc, s] of multiRegionLocs) fail(`Location ${loc} appears under several source regions: ${[...s].join(" / ")}`);
for (const label of rawRegions) if (!regionByLabel.has(label)) fail(`Unmapped source region label: "${label}"`);

// ---------------------------------------------------------------------------
// Matching: source location → COD-AB unit(s)
// ---------------------------------------------------------------------------

const matches = [];
for (const [clean, raws] of [...rawByClean].sort(([a], [b]) => a.localeCompare(b))) {
  const sourceRegionLabel = [...regionsByLoc.get(clean)][0];
  const region = regionByLabel.get(sourceRegionLabel);
  const ov = overrides.get(clean);
  const kind = ov?.target_kind || (clean.endsWith(" CITY") ? "city" : "province");
  const target = ov?.target_name || clean;
  const idx = kind === "province" ? adm2Index : adm3Index;
  const all = idx.get(target) ?? [];
  const inRegion = all.filter((c) => c.record.adm1_pcode === region?.region_pcode);
  const candidates = inRegion.length ? inRegion : all;
  const m = {
    clean,
    raws,
    sourceRegionLabel,
    sourceRegionPcode: region?.region_pcode ?? null,
    kind,
    target,
    override: ov ?? null,
    candidates: candidates.map((c) => c.record[kind === "province" ? "adm2_pcode" : "adm3_pcode"]),
    candidatesOutsideRegion: inRegion.length === 0 && all.length > 0,
  };
  if (candidates.length === 1) {
    m.record = candidates[0].record;
    m.via = candidates[0].via;
  }
  matches.push(m);
}
const unmatched = matches.filter((m) => m.candidates.length === 0);
const ambiguous = matches.filter((m) => m.candidates.length > 1);
for (const m of unmatched) fail(`Unmatched source location: ${m.clean} (${m.sourceRegionLabel})`);
for (const m of ambiguous) fail(`Ambiguous source location: ${m.clean} → ${m.candidates.join(", ")}`);

// ---------------------------------------------------------------------------
// Reporting units: partition of admin-3 space
// ---------------------------------------------------------------------------

const resolved = matches.filter((m) => m.record);
const cityUnits = resolved.filter((m) => m.kind !== "province");
const provinceUnits = resolved.filter((m) => m.kind === "province");

for (const m of cityUnits) {
  m.adm3 = [m.record];
  m.adm2Pcodes = [m.record.adm2_pcode];
}
for (const m of provinceUnits) {
  const extra = (m.override?.extra_adm2_pcodes || "").split(";").filter(Boolean);
  for (const e of extra) if (!adm2ByPcode.has(e)) fail(`Override for ${m.clean} names unknown admin-2 ${e}`);
  m.adm2Pcodes = [m.record.adm2_pcode, ...extra];
}
const cityAdm3 = new Map(cityUnits.map((m) => [m.record.adm3_pcode, m]));
for (const m of provinceUnits) {
  const members = m.adm2Pcodes.flatMap((pc) => adm3ByAdm2.get(pc) ?? []);
  m.carvedOut = members.filter((r) => cityAdm3.has(r.adm3_pcode)).map((r) => cityAdm3.get(r.adm3_pcode));
  m.adm3 = members.filter((r) => !cityAdm3.has(r.adm3_pcode));
  for (const c of m.carvedOut) c.geoProvince = m;
}

// Partition check: every COD-AB admin-3 belongs to exactly one reporting unit.
const owner = new Map();
for (const m of resolved)
  for (const r of m.adm3 ?? []) {
    if (owner.has(r.adm3_pcode)) fail(`Admin-3 ${r.adm3_pcode} ${r.adm3_name} assigned to both ${owner.get(r.adm3_pcode).clean} and ${m.clean}`);
    owner.set(r.adm3_pcode, m);
  }
const orphanAdm3 = adm3.filter((r) => !owner.has(r.adm3_pcode));
for (const r of orphanAdm3) fail(`Admin-3 ${r.adm3_pcode} ${r.adm3_name} (${r.adm2_name}) is in no reporting unit`);

// Duplicate mappings: two source identifiers resolving to the same COD-AB unit.
const byTarget = new Map();
for (const m of resolved) {
  const key = m.kind === "province" ? m.record.adm2_pcode : m.record.adm3_pcode;
  if (!byTarget.has(key)) byTarget.set(key, []);
  byTarget.get(key).push(m.clean);
}
const duplicateTargets = [...byTarget].filter(([, v]) => v.length > 1);
for (const [k, v] of duplicateTargets) fail(`Duplicate mapping: ${v.join(" + ")} → ${k}`);
const oneToMany = provinceUnits.filter((m) => m.adm2Pcodes.length > 1);

// Curated city classes: every city unit classified, and curated parent agrees with COD-AB nesting.
const parentDisagreements = [];
for (const m of cityUnits) {
  if (m.kind === "municipality") continue;
  const cls = cityClasses.get(m.target);
  if (!cls) {
    fail(`City ${m.clean} has no entry in city_classes.csv`);
    continue;
  }
  m.cityClass = cls.city_class;
  const derived = m.geoProvince?.clean ?? "";
  if (cls.parent_province !== derived) {
    parentDisagreements.push({ city: m.clean, curated: cls.parent_province || "(none)", codab: derived || "(own admin-2 / NCR)", basis: cls.basis });
  }
}
// Isabela City is the one documented case: curated parent Basilan, but COD-AB gives it its own admin-2.
const unexplainedParent = parentDisagreements.filter((d) => !(d.city === "ISABELA CITY" && d.codab === "(own admin-2 / NCR)"));
for (const d of unexplainedParent) fail(`City parent mismatch for ${d.city}: curated ${d.curated}, COD-AB ${d.codab}`);
for (const c of cityClasses.keys()) if (!cityUnits.some((m) => m.target === c)) fail(`city_classes.csv lists ${c}, which is not in the source`);

// Region consistency: source-period region vs COD-AB v03 region of the unit's territory.
for (const m of resolved) {
  m.codabRegions = [...new Set(m.adm3.map((r) => r.adm1_pcode))].sort();
  m.regionConsistency =
    m.codabRegions.length === 1 && m.codabRegions[0] === m.sourceRegionPcode
      ? "consistent"
      : m.codabRegions.includes(m.sourceRegionPcode)
        ? "partial"
        : "differs";
}

// Identity and geometry below assume a clean match; stop here with every matching error listed.
if (errors.length) finish();

// ---------------------------------------------------------------------------
// Unit identity, geometry summaries, representative points
// ---------------------------------------------------------------------------

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
/**
 * Representative point of a set of admin-3 units: the area-weighted mean of their centres, snapped
 * to the nearest member centre so it always lies inside the set (an archipelagic province's mean
 * can fall in the sea). For markers only — not a centroid of cases.
 */
function representativePoint(members) {
  const area = members.reduce((s, r) => s + Number(r.area_sqkm), 0);
  const lat = members.reduce((s, r) => s + Number(r.center_lat) * Number(r.area_sqkm), 0) / area;
  const lon = members.reduce((s, r) => s + Number(r.center_lon) * Number(r.area_sqkm), 0) / area;
  const nearest = members.reduce((best, r) => {
    const d = (Number(r.center_lat) - lat) ** 2 + ((Number(r.center_lon) - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    return !best || d < best.d ? { r, d } : best;
  }, null).r;
  return { point: { latitude: round(Number(nearest.center_lat), 5), longitude: round(Number(nearest.center_lon), 5) }, adm3: nearest.adm3_pcode, area };
}
// Display names drop COD-AB aliases such as "(Opon)" or "(Dadiangas)" but keep province aliases
// that disambiguate ("Cotabato (North Cotabato)", "Samar (Western Samar)").
const cityDisplayName = (adm3Name) => adm3Name.replace(/\s*\([^)]*\)/g, "").trim();
for (const m of resolved) {
  const isProvince = m.kind === "province";
  m.canonicalName = m.clean === "MAGUINDANAO" ? "Maguindanao" : isProvince ? baseName(m.record.adm2_name) : cityDisplayName(m.record.adm3_name);
  m.entityId =
    m.clean === "MAGUINDANAO" ? "maguindanao" : slug(isProvince ? norm(m.canonicalName.replace(/\(.*\)/, "")) : cityOf(norm(m.canonicalName)));
  m.level = isProvince ? "provincial" : "municipal";
}
for (const m of resolved) {
  if (m.kind === "province" && m.carvedOut.length) {
    m.unitType = "province_remainder";
    m.unitId = `${m.entityId}-remainder`;
    m.unitName = `${m.canonicalName} (excl. ${m.carvedOut.map((c) => c.canonicalName).join(", ")})`;
    const full = representativePoint([...m.adm3, ...m.carvedOut.flatMap((c) => c.adm3)]);
    m.provinceRepPoint = full.point;
  } else {
    m.unitType = m.kind === "province" ? "province_full" : m.kind === "municipality" ? "municipality" : `city_${m.cityClass.toLowerCase()}`;
    m.unitId = m.entityId;
    m.unitName = m.canonicalName;
  }
  const rep = representativePoint(m.adm3);
  m.repPoint = rep.point;
  m.repPointAdm3 = rep.adm3;
  m.areaSqkm = round(rep.area, 1);
}
const unitIds = resolved.map((m) => m.unitId);
const dupIds = unitIds.filter((id, i) => unitIds.indexOf(id) !== i);
for (const id of dupIds) fail(`Duplicate SIGMA unit id ${id}`);

// ---------------------------------------------------------------------------
// Temporal coverage per unit (identifier audit needs it to judge usability)
// ---------------------------------------------------------------------------

const unitByClean = new Map(resolved.map((m) => [m.clean, m]));
const allDates = [...new Set(records.map((r) => isoFromMdy(r.date)).filter(Boolean))].sort();
const FIRST = allDates[0];
const LAST = allDates.at(-1);
const expectedWeeks = [];
for (let d = FIRST; d <= LAST; d = addDays(d, 7)) expectedWeeks.push(d);
const unitWeekCount = new Map();
const datesByUnit = new Map();
for (const r of records) {
  const iso = isoFromMdy(r.date);
  if (!iso) continue;
  const key = `${cleanLoc(r.loc)}|${iso}`;
  unitWeekCount.set(key, (unitWeekCount.get(key) ?? 0) + 1);
  const c = cleanLoc(r.loc);
  if (!datesByUnit.has(c)) datesByUnit.set(c, []);
  datesByUnit.get(c).push(iso);
}
const duplicateUnitWeeks = [...unitWeekCount].filter(([, n]) => n > 1).map(([k, n]) => ({ key: k, n }));
const offGrid = allDates.filter((d) => daysBetween(FIRST, d) % 7 !== 0);

// Rows out of chronological order within their unit (appended after the unit's later weeks).
// In "swap blocks" — weeks where many units carry such a row — the deaths value tracks the
// neighbouring weeks' cases and the cases value is ~0–1: cases and deaths appear swapped.
// Values there are unusable — treated as missing, never zero and never silently swapped back.
const lastSeen = new Map();
const recordByUnitWeek = new Map();
for (const r of records) {
  r.iso = isoFromMdy(r.date);
  if (!r.iso) continue;
  r.unit = cleanLoc(r.loc);
  r.outOfOrder = lastSeen.has(r.unit) && r.iso < lastSeen.get(r.unit);
  if (!r.outOfOrder) lastSeen.set(r.unit, r.iso);
  recordByUnitWeek.set(`${r.unit}|${r.iso}`, r);
}
// Isolated out-of-order rows elsewhere (a few units) are ordering anomalies only.
const SHIFT_BLOCK_MIN_UNITS = 10;
const candidatesPerWeek = new Map();
for (const r of records) if (r.outOfOrder) candidatesPerWeek.set(r.iso, (candidatesPerWeek.get(r.iso) ?? 0) + 1);
const shiftBlockWeeks = new Set([...candidatesPerWeek].filter(([, n]) => n >= SHIFT_BLOCK_MIN_UNITS).map(([w]) => w));
for (const r of records) r.suspectShift = Boolean(r.outOfOrder && shiftBlockWeeks.has(r.iso));
const outOfOrderRows = records.filter((r) => r.outOfOrder);
const suspectRows = records.filter((r) => r.suspectShift);
const orderingOnly = outOfOrderRows.filter((r) => !r.suspectShift);
const orderingOnlyUnits = [...new Set(orderingOnly.map((r) => r.unit))].sort();
const usable = (r) => r.iso && !r.suspectShift && /^\d+$/.test(r.cases);
// Evidence for the shift: deaths in suspect rows vs mean cases of the unit's adjacent usable weeks.
const shiftPairs = [];
for (const r of suspectRows) {
  const nb = [-7, 7].map((o) => recordByUnitWeek.get(`${r.unit}|${addDays(r.iso, o)}`)).filter((x) => x && usable(x));
  if (nb.length && /^\d+$/.test(r.deaths)) shiftPairs.push([Number(r.deaths), nb.reduce((s, x) => s + Number(x.cases), 0) / nb.length]);
}
const pearson = (xs, ys) => {
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(xs);
  const my = mean(ys);
  let c = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < xs.length; i++) {
    c += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  return c / Math.sqrt(vx * vy);
};
const shiftCorr = pearson(shiftPairs.map(([d]) => Math.log1p(d)), shiftPairs.map(([, c]) => Math.log1p(c)));
const shiftMedianRatio = (() => {
  const r = shiftPairs.filter(([, c]) => c > 0).map(([d, c]) => d / c).sort((a, b) => a - b);
  return r[r.length >> 1];
})();
const suspectByRegionYear = {};
for (const r of suspectRows) {
  const key = `${r.region}|${r.iso.slice(0, 4)}`;
  suspectByRegionYear[key] ??= { region: r.region, year: r.iso.slice(0, 4), rows: 0, units: new Set(), weeks: new Set() };
  suspectByRegionYear[key].rows++;
  suspectByRegionYear[key].units.add(r.unit);
  suspectByRegionYear[key].weeks.add(r.iso);
}

const unitsPerWeek = new Map(expectedWeeks.map((w) => [w, 0]));
const usableUnitsPerWeek = new Map(expectedWeeks.map((w) => [w, 0]));
for (const r of records) {
  if (!r.iso) continue;
  unitsPerWeek.set(r.iso, unitsPerWeek.get(r.iso) + 1);
  if (usable(r)) usableUnitsPerWeek.set(r.iso, usableUnitsPerWeek.get(r.iso) + 1);
}
const nUnits = resolved.length;
const incompleteWeeks = expectedWeeks.filter((w) => usableUnitsPerWeek.get(w) < nUnits);
const emptyWeeks = expectedWeeks.filter((w) => unitsPerWeek.get(w) === 0);

const coverageRows = [];
for (const m of resolved) {
  const dates = [...new Set(datesByUnit.get(m.clean))].sort();
  const set = new Set(dates);
  const missing = expectedWeeks.filter((w) => !set.has(w));
  const suspectWeeks = suspectRows.filter((r) => r.unit === m.clean).map((r) => r.iso);
  const gaps = [];
  for (let i = 1; i < dates.length; i++) {
    const g = daysBetween(dates[i - 1], dates[i]);
    if (g > 7) gaps.push({ after: dates[i - 1], days: g });
  }
  m.coverage = {
    firstWeek: dates[0],
    lastWeek: dates.at(-1),
    weeksReported: dates.length,
    weeksUsable: dates.length - suspectWeeks.length,
    weeksSuspect: suspectWeeks.length,
    weeksExpected: expectedWeeks.length,
    missingWeeks: missing.length,
    gapCount: gaps.length,
    longestGapDays: gaps.reduce((s, g) => Math.max(s, g.days), 7),
    gaps,
    byYear: {},
  };
  for (const y of ["2016", "2017", "2018", "2019", "2020", "2021"]) {
    const exp = expectedWeeks.filter((w) => w.startsWith(y)).length;
    const got = dates.filter((w) => w.startsWith(y)).length;
    const sus = suspectWeeks.filter((w) => w.startsWith(y)).length;
    m.coverage.byYear[y] = { reported: got, suspect: sus, expected: exp };
    coverageRows.push({ unit_id: m.unitId, source_loc: m.clean, year: y, weeks_reported: got, weeks_suspect: sus, weeks_usable: got - sus, weeks_expected: exp, usable_completeness: exp ? round((got - sus) / exp, 3) : "" });
  }
}
writeCsv(p("data/processed/geo/hdx_unit_year_coverage.csv"), ["unit_id", "source_loc", "year", "weeks_reported", "weeks_suspect", "weeks_usable", "weeks_expected", "usable_completeness"], coverageRows);

// ---------------------------------------------------------------------------
// Consistency with the national OpenDengue series (cross-check only — never merged)
// ---------------------------------------------------------------------------

const od = JSON.parse(fs.readFileSync(p("web/src/data/opendengue-ph.json"), "utf8"));
const odByStart = new Map(od.rows.map((r) => [r.periodStart, r.value]));
const weekSum = new Map();
for (const r of records) if (usable(r)) weekSum.set(r.iso, (weekSum.get(r.iso) ?? 0) + Number(r.cases));
const completeWeeks = expectedWeeks.filter((w) => usableUnitsPerWeek.get(w) === nUnits);

// Swap test against the independent national series: in swap-block weeks, does swapping the
// suspect rows back bring the HDX total in line with OpenDengue?
const shiftWeeks = expectedWeeks.filter((w) => shiftBlockWeeks.has(w));
const shiftTest = shiftWeeks.map((w) => {
  const rows = records.filter((r) => r.iso === w && /^\d+$/.test(r.cases));
  const asIs = rows.reduce((s, r) => s + Number(r.cases), 0);
  const swapped = rows.reduce((s, r) => s + Number(r.suspectShift ? r.deaths || 0 : r.cases), 0);
  const odv = odByStart.get(addDays(w, -7));
  return { week: w, suspect: rows.filter((r) => r.suspectShift).length, asIs, swapped, od: odv ?? null };
});

// Exclusivity test: if province rows already contained their cities, the HDX total would overstate
// the true total by the city share. Compare both readings against OpenDengue on complete weeks.
const cityUnitSet = new Set(cityUnits.map((m) => m.clean));
const exclusivity = {};
for (const w of completeWeeks) {
  const y = w.slice(0, 4);
  const odv = odByStart.get(addDays(w, -7));
  if (!odv) continue;
  exclusivity[y] ??= { weeks: 0, hdx: 0, city: 0, od: 0 };
  const rows = records.filter((r) => r.iso === w && usable(r));
  exclusivity[y].weeks++;
  exclusivity[y].hdx += rows.reduce((s, r) => s + Number(r.cases), 0);
  exclusivity[y].city += rows.filter((r) => cityUnitSet.has(r.unit)).reduce((s, r) => s + Number(r.cases), 0);
  exclusivity[y].od += odv;
}
function alignment(offsetDays) {
  const xs = [];
  const ys = [];
  for (const w of completeWeeks) {
    const odv = odByStart.get(addDays(w, offsetDays));
    if (odv) {
      xs.push(weekSum.get(w));
      ys.push(odv);
    }
  }
  const lx = xs.map(Math.log);
  const ly = ys.map(Math.log);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(lx);
  const my = mean(ly);
  let c = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < lx.length; i++) {
    c += (lx[i] - mx) * (ly[i] - my);
    vx += (lx[i] - mx) ** 2;
    vy += (ly[i] - my) ** 2;
  }
  const ratios = xs.map((x, i) => x / ys[i]).sort((a, b) => a - b);
  return { offsetDays, n: xs.length, r: c / Math.sqrt(vx * vy), medianRatio: ratios[ratios.length >> 1] };
}
const alignments = [-14, -7, 0, 7].map(alignment);
const annual = {};
for (const w of expectedWeeks) {
  const y = w.slice(0, 4);
  annual[y] ??= { hdx: 0, hdxWeeks: 0, completeWeeks: 0 };
  annual[y].hdx += weekSum.get(w) ?? 0;
  annual[y].hdxWeeks += unitsPerWeek.get(w) > 0 ? 1 : 0;
  annual[y].completeWeeks += usableUnitsPerWeek.get(w) === nUnits ? 1 : 0;
}
for (const r of od.rows) {
  const y = r.periodStart.slice(0, 4);
  if (annual[y]) annual[y].od = (annual[y].od ?? 0) + r.value;
}

// ---------------------------------------------------------------------------
// COD-PS denominator compatibility
// ---------------------------------------------------------------------------

const codps = readCsvRecords(CODPS_ADM2_FILE);
const codpsPcodes = codps.map((r) => r.ADM2_PCODE);
const codpsJoinable = codpsPcodes.filter((pc) => adm2ByPcode.has(pc)).length;
const codpsNcrRows = codps.filter((r) => /NCR|National Capital/i.test(r.ADM1_NAME)).length;

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

if (errors.length) finish();

const prov = (id) => manifest[id];
const regionIdByPcode = (pc) => regionById.get(pc)?.region_id ?? null;
const sorted = [...resolved].sort((a, b) => a.unitId.localeCompare(b.unitId));

// 1. Crosswalk (the documented mapping).
writeCsv(
  p("data/reference/geo/hdx_dengue_crosswalk.csv"),
  [
    "source_loc_raw", "source_loc_clean", "ml_geography_name", "source_region_raw", "unit_id", "unit_name", "unit_type", "sigma_level",
    "geographic_entity_id", "geographic_province_id", "match_decision", "matched_via", "cod_ab_level", "cod_ab_pcodes",
    "psgc10_derived", "member_adm3_count", "excluded_unit_ids", "analysis_region_pcode", "analysis_region_id",
    "cod_ab_v03_region_pcodes", "region_consistency", "rep_lat", "rep_lon", "rep_point_adm3", "area_sqkm",
    "weeks_reported", "weeks_expected", "notes",
  ],
  sorted.map((m) => ({
    source_loc_raw: m.raws.join(" | "),
    source_loc_clean: m.clean,
    // Join key for ml/clean_dengue.py output (geography_name), which fixes the same misspellings.
    ml_geography_name: m.override?.decision === "manual_typo" ? m.override.target_name : m.clean,
    source_region_raw: m.sourceRegionLabel,
    unit_id: m.unitId,
    unit_name: m.unitName,
    unit_type: m.unitType,
    sigma_level: m.level,
    geographic_entity_id: m.entityId,
    geographic_province_id: m.kind === "province" ? m.entityId : (m.geoProvince?.entityId ?? ""),
    match_decision: m.override?.decision ?? (m.raws.some((r) => r !== m.clean) ? "normalized" : "exact"),
    matched_via: m.via,
    cod_ab_level: m.kind === "province" ? "adm2" : "adm3",
    cod_ab_pcodes: m.kind === "province" ? m.adm2Pcodes.join(";") : m.record.adm3_pcode,
    psgc10_derived: (m.kind === "province" ? m.adm2Pcodes : [m.record.adm3_pcode]).map(psgc10).join(";"),
    member_adm3_count: m.adm3.length,
    excluded_unit_ids: (m.carvedOut ?? []).map((c) => c.unitId).sort().join(";"),
    analysis_region_pcode: m.sourceRegionPcode,
    analysis_region_id: regionIdByPcode(m.sourceRegionPcode),
    cod_ab_v03_region_pcodes: m.codabRegions.join(";"),
    region_consistency: m.regionConsistency,
    rep_lat: m.repPoint.latitude,
    rep_lon: m.repPoint.longitude,
    rep_point_adm3: m.repPointAdm3,
    area_sqkm: m.areaSqkm,
    weeks_reported: m.coverage.weeksReported,
    weeks_expected: m.coverage.weeksExpected,
    notes: [m.override?.reason, cityClasses.get(m.target)?.basis && cityClasses.get(m.target).basis !== "NCR city" ? cityClasses.get(m.target).basis : ""]
      .filter(Boolean)
      .join(" "),
  })),
);

// 2. Rows for the master data hub GEOGRAPHY tab (its exact column order).
const hubRows = [];
const asOf = CODAB_VALID_ON;
const hubSource = "OCHA COD-AB PHL v03 (NAMRIA/PSA) + HDX DOH-Epi dengue crosswalk";
const hubUrl = "https://data.humdata.org/dataset/cod-ab-phl";
hubRows.push({ geography_id: "ph", geography_name: "Philippines", geographic_level: "national", parent_id: "", psgc_code: "", latitude: "", longitude: "", region: "", province: "", city_municipality: "", barangay: "", source: hubSource, source_url: hubUrl, as_of_date: asOf, resolution_status: "RESOLVED", notes: "" });
for (const r of adm1) {
  const label = regionById.get(r.adm1_pcode);
  hubRows.push({ geography_id: label.region_id, geography_name: r.adm1_name, geographic_level: "regional", parent_id: "ph", psgc_code: "", latitude: round(Number(r.center_lat), 5), longitude: round(Number(r.center_lon), 5), region: r.adm1_name, province: "", city_municipality: "", barangay: "", source: hubSource, source_url: hubUrl, as_of_date: asOf, resolution_status: "RESOLVED", notes: `COD-AB ${r.adm1_pcode}; derived PSGC ${psgc10(r.adm1_pcode)} (unverified)` });
}
const adm1Name = new Map(adm1.map((r) => [r.adm1_pcode, r.adm1_name]));
for (const m of sorted) {
  const regionName = adm1Name.get(m.sourceRegionPcode);
  const status = m.regionConsistency === "consistent" && !m.override?.decision?.startsWith("manual_vintage") ? "RESOLVED" : "RESOLVED_WITH_CAVEAT";
  const base = { source: hubSource, source_url: hubUrl, as_of_date: asOf, region: regionName, barangay: "" };
  if (m.unitType === "province_remainder") {
    // Full province entity first (aggregation target), then the reporting unit.
    hubRows.push({ ...base, geography_id: m.entityId, geography_name: m.canonicalName, geographic_level: "provincial", parent_id: regionIdByPcode(m.sourceRegionPcode), psgc_code: "", latitude: "", longitude: "", province: m.canonicalName, city_municipality: "", resolution_status: status, notes: `Full province (aggregate of ${[m.unitId, ...m.carvedOut.map((c) => c.unitId)].join(" + ")}); COD-AB ${m.adm2Pcodes.join("+")}` });
    hubRows.push({ ...base, geography_id: m.unitId, geography_name: m.unitName, geographic_level: "provincial", parent_id: m.entityId, psgc_code: "", latitude: m.repPoint.latitude, longitude: m.repPoint.longitude, province: m.canonicalName, city_municipality: "", resolution_status: status, notes: `REPORTING UNIT, not a full province: excludes separately reported ${m.carvedOut.map((c) => c.unitId).join(", ")}. Source loc "${m.clean}".` });
  } else if (m.kind === "province") {
    hubRows.push({ ...base, geography_id: m.unitId, geography_name: m.unitName, geographic_level: "provincial", parent_id: regionIdByPcode(m.sourceRegionPcode), psgc_code: "", latitude: m.repPoint.latitude, longitude: m.repPoint.longitude, province: m.canonicalName, city_municipality: "", resolution_status: status, notes: `COD-AB ${m.adm2Pcodes.join("+")}; source loc "${m.clean}"` });
  } else {
    hubRows.push({ ...base, geography_id: m.unitId, geography_name: m.unitName, geographic_level: "municipal", parent_id: m.geoProvince?.entityId ?? regionIdByPcode(m.sourceRegionPcode), psgc_code: "", latitude: m.repPoint.latitude, longitude: m.repPoint.longitude, province: m.geoProvince?.canonicalName ?? "", city_municipality: m.unitName, resolution_status: status, notes: `${m.cityClass ?? "municipality"}; COD-AB ${m.record.adm3_pcode}; source loc "${m.clean}"` });
  }
}
writeCsv(
  p("data/reference/geo/geography_hub_rows.csv"),
  ["geography_id", "geography_name", "geographic_level", "parent_id", "psgc_code", "latitude", "longitude", "region", "province", "city_municipality", "barangay", "source", "source_url", "as_of_date", "resolution_status", "notes"],
  hubRows,
);

// 3. Frontend fixture. Entities follow GeographicEntity (web/src/types/data.ts) plus
//    reporting-unit fields proposed in docs/geo/geographic-schema-proposal.md.
const recordedAt = prov("cod-ab-phl").retrievedAt;
const provenanceFor = (upstreamId) => ({
  sourceIds: ["cod-ab-phl", "hdx-doh-epi-dengue"],
  method: "derived",
  pipeline: `${GENERATOR}@${PIPELINE_VERSION}`,
  upstreamId,
  upstreamUrl: "https://data.humdata.org/dataset/cod-ab-phl",
  upstreamVersion: `COD-AB PHL ${CODAB_VERSION}`,
  retrievedAt: recordedAt,
  recordedAt,
  isSample: false,
});
const entities = [];
entities.push({ id: "ph", name: "Philippines", level: "national", parentId: null, psgcCode: null, centroid: null, provenance: provenanceFor("PH"), kind: "admin" });
for (const r of adm1) {
  entities.push({ id: regionById.get(r.adm1_pcode).region_id, name: r.adm1_name, level: "regional", parentId: "ph", psgcCode: null, centroid: { latitude: round(Number(r.center_lat), 5), longitude: round(Number(r.center_lon), 5) }, provenance: provenanceFor(r.adm1_pcode), kind: "admin", codAbPcodes: [r.adm1_pcode] });
}
for (const m of sorted) {
  const region = regionIdByPcode(m.sourceRegionPcode);
  const common = { psgcCode: null, provenance: provenanceFor((m.kind === "province" ? m.adm2Pcodes : [m.record.adm3_pcode]).join("+")) };
  if (m.unitType === "province_remainder") {
    entities.push({ id: m.entityId, name: m.canonicalName, level: "provincial", parentId: region, centroid: m.provinceRepPoint, ...common, kind: "admin", codAbPcodes: m.adm2Pcodes, reportingUnitIds: [m.unitId, ...m.carvedOut.map((c) => c.unitId)].sort() });
    entities.push({ id: m.unitId, name: m.unitName, level: "provincial", parentId: m.entityId, centroid: m.repPoint, ...common, kind: "reporting_unit", partialOf: m.entityId, excludes: m.carvedOut.map((c) => c.unitId).sort(), analysisRegionId: region, sourceLoc: m.clean });
  } else {
    const parent = m.kind === "province" ? region : (m.geoProvince?.entityId ?? region);
    entities.push({
      id: m.unitId, name: m.unitName, level: m.level, parentId: parent, centroid: m.repPoint, ...common,
      kind: "admin",
      codAbPcodes: m.kind === "province" ? m.adm2Pcodes : [m.record.adm3_pcode],
      reportingUnitIds: [m.unitId],
      analysisRegionId: region,
      sourceLoc: m.clean,
      ...(m.cityClass ? { cityClass: m.cityClass } : {}),
    });
  }
}
const aggregation = { province: {}, region: {}, national: { ph: sorted.map((m) => m.unitId) } };
for (const m of provinceUnits) aggregation.province[m.entityId] = [m.unitId, ...m.carvedOut.map((c) => c.unitId)].sort();
for (const m of sorted) (aggregation.region[regionIdByPcode(m.sourceRegionPcode)] ??= []).push(m.unitId);
const fixture = {
  meta: {
    description: "Canonical geography for the HDX DOH-Epi dengue dataset (2016–2021): 126 reporting units, the 81 provinces and 17 regions they aggregate to, and representative points. Geography only — no case values.",
    generator: GENERATOR,
    pipelineVersion: PIPELINE_VERSION,
    boundaryReference: { source: "OCHA COD-AB PHL", version: CODAB_VERSION, validOn: CODAB_VALID_ON, license: "CC BY-IGO", sha256: prov("cod-ab-phl").sha256 },
    observationSource: { source: "HDX — Philippine Dengue Cases and Deaths (Cirrolytix; DOH-EB data)", license: "CC BY", sha256: prov("hdx-doh-epi-dengue").sha256 },
    crosswalk: "data/reference/geo/hdx_dengue_crosswalk.csv",
    report: "docs/geo/geo-data-quality-report.md",
    schemaProposal: "docs/geo/geographic-schema-proposal.md",
    rules: [
      "Reporting units are mutually exclusive and together cover all 1,642 COD-AB admin-3 units (checked).",
      "A province_remainder unit is NOT the whole province; aggregate with its excluded cities to obtain the province.",
      "Sum only upward (unit → province → region → national) and only for weeks where every member unit reported.",
      "Never split a unit, province, region or national value into smaller areas.",
      "centroid is a representative point inside the unit for markers, not a boundary and not a location of cases.",
      "psgcCode stays null until codes are verified against a PSA PSGC publication; codAbPcodes carry the COD-AB codes.",
    ],
    counts: {
      reportingUnits: resolved.length,
      provinceFull: resolved.filter((m) => m.unitType === "province_full").length,
      provinceRemainder: resolved.filter((m) => m.unitType === "province_remainder").length,
      cities: cityUnits.filter((m) => m.kind === "city").length,
      municipalities: cityUnits.filter((m) => m.kind === "municipality").length,
      provinces: provinceUnits.length,
      regions: adm1.length,
    },
  },
  entities,
  aggregation,
  coverage: Object.fromEntries(sorted.map((m) => [m.unitId, { firstWeek: m.coverage.firstWeek, lastWeek: m.coverage.lastWeek, weeksReported: m.coverage.weeksReported, weeksExpected: m.coverage.weeksExpected, gapCount: m.coverage.gapCount, longestGapDays: m.coverage.longestGapDays }])),
};
fs.mkdirSync(p("web/src/data/geo"), { recursive: true });
fs.writeFileSync(p("web/src/data/geo/hdx-reporting-units.json"), JSON.stringify(fixture, null, 1) + "\n");

// 4. Data-quality report.
writeReport();
finish();

// ---------------------------------------------------------------------------

function writeReport() {
  const fmt = (n) => Number(n).toLocaleString("en-US");
  const t = (head, rows) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
  const decisionCounts = {};
  for (const m of resolved) {
    const d = m.override?.decision ?? (m.raws.some((r) => r !== m.clean) ? "normalized" : "exact");
    decisionCounts[d] = (decisionCounts[d] ?? 0) + 1;
  }
  const typeCounts = {};
  for (const m of resolved) typeCounts[m.unitType] = (typeCounts[m.unitType] ?? 0) + 1;
  const viaAlias = resolved.filter((m) => m.via === "alias");
  const remainders = sorted.filter((m) => m.unitType === "province_remainder");
  const regionIssues = sorted.filter((m) => m.regionConsistency !== "consistent");
  const gappy = sorted.filter((m) => m.coverage.gapCount > 0).sort((a, b) => b.coverage.missingWeeks - a.coverage.missingWeeks);
  const gapHistogram = {};
  for (const m of resolved) for (const g of m.coverage.gaps) gapHistogram[g.days] = (gapHistogram[g.days] ?? 0) + 1;
  const lowCoverageYears = coverageRows.filter((r) => r.year !== "2021" && r.usable_completeness < 0.9);
  const years = ["2016", "2017", "2018", "2019", "2020"];
  const incompleteByYear = Object.fromEntries(years.map((y) => [y, incompleteWeeks.filter((w) => w.startsWith(y)).length]));

  const md = `# Geographic data-quality report — HDX DOH-Epi dengue 2016–2021

> **Generated** by \`${GENERATOR}\` (${PIPELINE_VERSION}). Do not edit by hand; change the curated
> inputs in \`data/reference/geo/\` and rerun. Interpretation and recommendations are in
> [spatial-assessment-and-method.md](spatial-assessment-and-method.md).

## 1. Inputs

| Input | File | SHA-256 | Licence | Retrieved |
| --- | --- | --- | --- | --- |
${sources.map((s) => `| ${s.title} | \`${manifest[s.id].file}\` | \`${manifest[s.id].sha256.slice(0, 16)}…\` | ${s.license} | ${manifest[s.id].retrievedAt.slice(0, 10)} |`).join("\n")}

- Boundary reference: OCHA COD-AB PHL **${CODAB_VERSION}**, valid on ${CODAB_VALID_ON}: ${adm1.length} regions, ${adm2.length} admin-2, ${fmt(adm3.length)} admin-3 units.
- The dengue file is published on HDX by **Cirrolytix** (a third party), attributed to DOH-EB. Its description calls the counts "confirmed", then says they include suspect, probable and confirmed cases. Treat the case definition as **total reported (suspect + probable + confirmed)**.
- HDX metadata lists the file as 1,599,449 bytes, but the download is ${fmt(fs.statSync(DENGUE_FILE).size)} bytes. The cause is unknown; the metadata may be from an earlier upload. The SHA-256 above identifies the copy SIGMA uses.

## 2. File structure

| Check | Result |
| --- | --- |
| Header | \`${header.join(",")}\` |
| Row 2 (HXL tags, treated as metadata) | \`${hxl.join(",")}\` |
| Data rows | ${fmt(records.length)} |
| Rows with ≠ 5 fields | ${recordIssues.badFieldCount.length} |
| Unparseable dates (expected M/D/YYYY) | ${recordIssues.badDate.length} |
| Dates not on a Sunday | ${recordIssues.notSunday.length} |
| Dates off the 7-day grid from ${FIRST} | ${offGrid.length} |
| Date range | ${FIRST} → ${LAST} (${expectedWeeks.length} weekly slots) |
| Non-integer / negative cases | ${recordIssues.badCases.length} |
| Missing deaths | ${recordIssues.missingDeaths.length}${recordIssues.missingDeaths.length ? ` (${recordIssues.missingDeaths.map((r) => `line ${r.line}: ${r.loc.trim()} ${r.date}`).join("; ")})` : ""} |
| Deaths > cases | ${recordIssues.deathsExceedCases.length}${recordIssues.deathsExceedCases.length ? ` (${recordIssues.deathsExceedCases.slice(0, 5).map((r) => `${r.loc.trim()} ${r.date}: ${r.deaths} > ${r.cases}`).join("; ")})` : ""} |
| Duplicate location-week rows | ${duplicateUnitWeeks.length} |

**The \`#adm2+name\` HXL tag on \`loc\` is wrong.** The column mixes ${typeCounts.province_full + typeCounts.province_remainder} provinces, ${cityUnits.filter((m) => m.kind === "city").length} cities and ${cityUnits.filter((m) => m.kind === "municipality").length} municipality. They are DOH reporting units, not one administrative level. Any tool that trusts the tag will mis-join the 45 city and municipal rows to admin-2 polygons.

## 3. Identifier audit

### 3.1 Raw identifier problems

| Problem | Identifiers |
| --- | --- |
| Leading or trailing whitespace in \`loc\` | ${locWhitespace.map((s) => `\`${JSON.stringify(s)}\``).join(", ") || "none"} |
| Same name spelled two ways in the raw file | ${spellingVariants.map(([c, v]) => `${c}: ${v.map((s) => JSON.stringify(s)).join(" / ")}`).join("; ") || "none"} |
| Misspellings (fixed through \`name_overrides.csv\`) | ${[...overrides.values()].filter((o) => o.decision === "manual_typo").map((o) => `${o.source_loc} → ${o.target_name}`).join(", ")} |
| Non-standard names | ${[
    ...[...overrides.values()].filter((o) => o.decision === "manual_name").map((o) => `${o.source_loc} → ${o.target_name}`),
    ...viaAlias.map((m) => `${m.clean} (matched on COD-AB alias in "${m.kind === "province" ? m.record.adm2_name : m.record.adm3_name}")`),
  ].join("; ")} |
| Boundary-vintage names | ${[...overrides.values()].filter((o) => o.decision === "manual_vintage").map((o) => `${o.source_loc}`).join(", ")} (see §4) |
| Region labels with inconsistent casing | ${regionCasing.map((s) => `\`${s}\``).join(", ")} |
| Region label with the wrong numeral | \`REGION VII-EASTERN VISAYAS\`: every member is in Region VIII (PH08). It is mapped by membership. |
| Anachronistic region label | \`BARMM\` is used for 2016–2018, when the region was ARMM. |

### 3.2 Matching results

- Source identifiers: **${matches.length}**. Matched: **${resolved.length}**. **Unmatched: ${unmatched.length}.** **Ambiguous: ${ambiguous.length}.**
- How each was matched: ${Object.entries(decisionCounts).map(([k, v]) => `${k} ${v}`).join(", ")}.
- Reporting-unit types: ${Object.entries(typeCounts).map(([k, v]) => `${k} ${v}`).join(", ")}.
- City classes (curated in \`city_classes.csv\`): HUC ${cityUnits.filter((m) => m.cityClass === "HUC").length}, ICC ${cityUnits.filter((m) => m.cityClass === "ICC").length}, CC ${cityUnits.filter((m) => m.cityClass === "CC").length}. These numbers match PSA's count of 33 HUCs and 5 ICCs, which means **every** HUC and ICC is reported separately, plus 6 component cities, 5 of them in Caraga. The class list was curated by hand because psa.gov.ph returns HTTP 403 to scripted downloads. A team member should check it against the current PSGC publication.

### 3.3 Duplicate and one-to-many mappings

- Two source identifiers mapped to the same COD-AB unit: **${duplicateTargets.length}**.
- One source identifier mapped to several COD-AB admin-2 units, for boundary-vintage reasons: ${oneToMany.map((m) => `**${m.clean}** → ${m.adm2Pcodes.join(" + ")}`).join("; ")}.
- SIGMA unit ids are unique: ${dupIds.length === 0 ? "yes" : "NO"}.

### 3.4 Partition test

Every COD-AB admin-3 unit must belong to exactly one reporting unit. Result: ${fmt(owner.size)} of ${fmt(adm3.length)} assigned, ${orphanAdm3.length} orphaned, 0 assigned twice. **The 126 reporting units are mutually exclusive and cover the whole country.** This is what makes summing units up to provinces and regions geographically valid.

### 3.5 Province rows that exclude separately reported cities

${remainders.length} province rows do **not** cover the whole province. The cities inside them are reported on their own rows. The other ${provinceUnits.length - remainders.length} province rows do cover the whole province.

${t(["Province (source)", "Reporting unit id", "Excludes"], remainders.map((m) => [m.clean, `\`${m.unitId}\``, m.carvedOut.map((c) => c.target).join(", ")]))}

Curated parent provinces in \`city_classes.csv\` disagree with COD-AB nesting in ${parentDisagreements.length} case(s): ${parentDisagreements.map((d) => `${d.city} (curated ${d.curated}, COD-AB ${d.codab}; ${d.basis})`).join("; ") || "none"}.

## 4. Boundary and naming inconsistencies (source period vs COD-AB ${CODAB_VERSION})

Source-period region compared with the COD-AB ${CODAB_VERSION} region of each unit's territory: ${regionIssues.length} unit(s) differ.

${t(["Unit", "Source region", "COD-AB v03 region(s)", "Status", "Why"], regionIssues.map((m) => [m.clean, m.sourceRegionPcode, m.codabRegions.join(" + "), m.regionConsistency, (m.override?.reason ?? cityClasses.get(m.target)?.basis ?? "").replace(/\|/g, "/")]))}

Other boundary changes that affect 2016–2021:

- **Negros Island Region** (2015-05-29 to 2017-08-09). Negros Occidental and Bacolod are placed in Region VI, and Negros Oriental in Region VII, for every year. Regional totals for 2016 to mid-2017 therefore follow the post-2017 regions, not the regions legally in force at the time.
- **Compostela Valley → Davao de Oro** (renamed in December 2019). The source uses the new name throughout. COD-AB lists the old name as an alias. Matched to a single unit; nothing is lost.
- **Maguindanao split (2022).** The source province equals Maguindanao del Norte + del Sur in COD-AB v03, minus Cotabato City.
- **Special Geographic Area (BARMM, PH19099).** Its 63 barangays came from North Cotabato municipalities. They are assigned to the North Cotabato unit for 2016–2021. This is an **unverified assumption**.
- **Cotabato City.** The source keeps it in Region XII. COD-AB v03 puts it in BARMM / Maguindanao del Norte. SIGMA uses the **source-period region** (\`analysis_region_id\`) for regional aggregation.
- **Isabela City.** It is administratively in Region IX but geographically on Basilan. COD-AB gives it its own admin-2 unit, so Basilan's polygon already excludes it.

## 5. Temporal coverage by unit

A unit-week is **usable** when the row exists and is not a suspected swap row (§5.1).

- Weekly slots: ${expectedWeeks.length}. Weeks where all ${nUnits} units have a usable row: **${completeWeeks.length}**. Weeks with at least one unit missing or suspect: ${incompleteWeeks.length}${emptyWeeks.length ? `. Weeks with **no rows for any unit**: ${emptyWeeks.join(", ")}` : ""}.
- Incomplete weeks per year: ${years.map((y) => `${y}: ${incompleteByYear[y]}`).join(", ")}. 2021 has ${expectedWeeks.filter((w) => w.startsWith("2021")).length} weekly slot(s), so it is not a season.
- Gaps between consecutive rows, by length in days: ${Object.entries(gapHistogram).sort(([a], [b]) => a - b).map(([d, n]) => `${d} d × ${n}`).join(", ")}. ${emptyWeeks.length ? `${nUnits} of these are the single nationwide missing week ${emptyWeeks.join(", ")}. The 14-day gaps are therefore mostly **missing weeks**, not a fortnightly reporting cycle.` : ""}
- Units with at least one gap: ${gappy.length} of ${nUnits}. Missing unit-weeks in total: ${fmt(resolved.reduce((s, m) => s + m.coverage.missingWeeks, 0))} of ${fmt(nUnits * expectedWeeks.length)}. Suspect unit-weeks: ${fmt(suspectRows.length)}.
- Unit-years below 90% usable completeness (2016–2020): ${lowCoverageYears.length}${lowCoverageYears.length ? `: ${lowCoverageYears.slice(0, 40).map((r) => `${r.source_loc} ${r.year} (${r.weeks_usable}/${r.weeks_expected})`).join(", ")}${lowCoverageYears.length > 40 ? ", …" : ""}` : ""}.
- **Davao Occidental has no rows in 2016.** The province was created from Davao del Sur in 2013, and its 2016 cases may be inside the Davao del Sur row. The data cannot confirm this. Any analysis that includes 2016 should merge the two into one consistent-geography unit, or drop Davao Occidental in 2016. It must not treat the unit as zero.

Missing weeks are absent rows. They are **never** zero. Full per-unit, per-year table: \`data/processed/geo/hdx_unit_year_coverage.csv\`.

### 5.1 Suspected cases↔deaths column swap (spatially structured)

- ${fmt(outOfOrderRows.length)} rows are out of chronological order within their unit. They are appended after later weeks of the same unit.
- **Swap blocks** are the ${shiftBlockWeeks.size} weeks in which ≥ ${SHIFT_BLOCK_MIN_UNITS} units have an appended row. ${fmt(suspectRows.length)} rows fall in them. In those rows \`cases\` is 0 in ${suspectRows.filter((r) => r.cases === "0").length}, 1 in ${suspectRows.filter((r) => r.cases === "1").length}, and higher in ${suspectRows.filter((r) => Number(r.cases) > 1).length}.
- The other ${fmt(orderingOnly.length)} out-of-order rows belong to ${orderingOnlyUnits.length} units (${orderingOnlyUnits.join(", ")}). They are ordering anomalies only. Sort by date; the values are kept.
- In those ${fmt(suspectRows.length)} rows, the \`deaths\` value tracks the unit's adjacent-week case counts: Pearson r = **${shiftCorr.toFixed(3)}** on log(1+x), n = ${shiftPairs.length}. The median of deaths ÷ adjacent cases is ${shiftMedianRatio.toFixed(2)}.
- The pattern is very likely **cases and deaths swapped**. The case count sits in \`deaths\`, and a death count (usually 0 or 1) sits in \`cases\`. This explains why ${fmt(recordIssues.deathsExceedCases.length)} rows have deaths > cases, and why annual death totals are inflated.
- **It is regional.** Whole regions are affected in specific alternating weeks:

${t(["Source region", "Year", "Units", "Weeks", "Rows"], Object.values(suspectByRegionYear).sort((a, b) => a.year.localeCompare(b.year) || a.region.localeCompare(b.region)).map((s) => [s.region, s.year, s.units.size, [...s.weeks].sort().join(" "), s.rows]))}

**Swap test against OpenDengue** (swap-block weeks; OpenDengue week = HDX date − 7 days):

${t(["HDX week", "Suspect rows", "HDX sum as published", "HDX sum, suspect rows swapped back", "OpenDengue"], shiftTest.map((s) => [s.week, s.suspect, fmt(s.asIs), fmt(s.swapped), s.od === null ? "—" : fmt(s.od)]))}

- **2016–2017:** swapping the suspect rows back brings most block weeks into line with OpenDengue. This supports the swap hypothesis.
- **2020:** the as-published sums match better. This is not independent evidence against the swap. OpenDengue's 2020 weeks come from \`MOH-PHL\` upstream records (${[...new Set(od.rows.filter((r) => r.periodStart.startsWith("2020")).map((r) => r.sourceRecordId))].join(", ")}), which may be built from the same DOH tables and carry the same error.

**Handling rule (proposed to the cleaning workstream):** treat cases and deaths in these rows as **missing**. Never treat them as 0, and never swap them back silently. A swap-back can be offered as a documented sensitivity analysis. Because whole regions drop out in the same weeks, leaving these zeros in would draw a **false regional dip** in any map or spatial statistic, and a false drop in EARS baselines.

## 6. Consistency with the national OpenDengue series (cross-check only)

**The two series are compared here, never merged.** The first table counts usable rows only.

${t(["Year", "HDX sum (usable rows)", "Complete weeks", "OpenDengue national", "Ratio"], years.map((y) => [y, fmt(annual[y].hdx), annual[y].completeWeeks, annual[y].od ? fmt(annual[y].od) : "—", annual[y].od ? (annual[y].hdx / annual[y].od).toFixed(3) : "—"]))}

**Exclusivity test.** Do province rows already include their separately reported cities? The test uses complete weeks only, with OpenDengue week = HDX date − 7 days.

- If they **do not** (the reporting units are exclusive), the true total is the HDX sum.
- If they **do**, the cities are counted twice, and the true total is the HDX sum minus the city rows.

${t(["Year", "Weeks", "City share of HDX sum", "Ratio if exclusive", "Ratio if cities double-counted"], Object.entries(exclusivity).filter(([y]) => y !== "2021").map(([y, e]) => [y, e.weeks, `${((100 * e.city) / e.hdx).toFixed(1)}%`, (e.hdx / e.od).toFixed(3), ((e.hdx - e.city) / e.od).toFixed(3)]))}

Weekly alignment of the HDX sum against OpenDengue \`periodStart\` (complete weeks only, log scale):

${t(["HDX date + offset", "Weeks matched", "Pearson r (log)", "Median HDX / OD"], alignments.map((a) => [`${a.offsetDays >= 0 ? "+" : ""}${a.offsetDays} d`, a.n, a.r.toFixed(4), a.medianRatio.toFixed(3)]))}

Reading:

- **Exclusivity.** Under the exclusive reading, the HDX total is consistently a little **above** OpenDengue. Under the double-counting reading, it is well **below**: cities are ${(() => {
    const s = Object.entries(exclusivity).filter(([y]) => y !== "2021").map(([, e]) => (100 * e.city) / e.hdx);
    return `${Math.min(...s).toFixed(0)}–${Math.max(...s).toFixed(0)}%`;
  })()} of the total. The exclusive reading is closer in most years, and very close in 2019.
- The exclusive reading also agrees with the partition structure (§3.4) and with the DOH practice of reporting HUCs and ICCs as separate units. It is **supported, not proven**. If DOH-EB confirms it, the assumption can be removed.
- **Date alignment.** The best alignment is with HDX dates shifted 1–2 weeks **earlier**. The HDX \`date\` is therefore probably not the morbidity-week start; it may be an end-of-week or report date. **Unresolved.** This affects EARS lead-time and is referred to the temporal/EARS workstream.
- **Other differences** may come from the case definition, reporting delays and later revisions. OpenDengue mixes WHO WPRO and MOH sources.

## 7. Population denominators (COD-PS)

- COD-PS admin-2 2022 has ${codps.length} rows. Rows whose \`ADM2_PCODE\` matches a COD-AB ${CODAB_VERSION} admin-2 pcode: **${codpsJoinable}**. COD-PS uses the older 9-digit PSGC-style P-codes (for example ARMM = PH15…), so it cannot be joined to COD-AB v03 without a crosswalk.
- COD-PS has ${codpsNcrRows} NCR row(s) and no city-level rows. It cannot give denominators for the 44 separately reported cities, and so it cannot give denominators for the province remainders either.
- The projections are for 2022–2025. The dengue data covers 2016–2021.
- **Result: no valid population denominator exists today at reporting-unit level.** Incidence rates are not supported. See the assessment document.
`;
  fs.mkdirSync(p("docs/geo"), { recursive: true });
  fs.writeFileSync(p("docs/geo/geo-data-quality-report.md"), md);
}

function finish() {
  if (errors.length) {
    console.error(`✗ ${errors.length} invariant(s) failed:`);
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log(`✓ ${resolved.length} reporting units; partition of ${adm3.length} admin-3 OK; outputs written.`);
  process.exit(0);
}
