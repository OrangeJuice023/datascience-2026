#!/usr/bin/env node
/**
 * Builds web/src/data/opendengue-ph.json from the data track's canonical,
 * validated OpenDengue file:
 *
 *   data/processed/opendengue/ph_weekly_national_2012_2023.csv
 *   (produced by scripts/build_opendengue.py; see
 *    planning/OPENDENGUE_RECONCILIATION.md)
 *
 * The input is read-only. Rows are copied as published: no interpolation,
 * no zero-filling, no re-aggregation, no geographic redistribution. Missing
 * weeks stay missing (absent rows).
 *
 * Before writing, the input is checked against the reconciliation's verified
 * figures; any mismatch aborts without touching the output.
 *
 * Deterministic: the same input and flags produce byte-identical output. The
 * input's SHA-256 is recorded so the fixture traces back to its exact file.
 *
 * Usage (from web/):
 *   node scripts/build-opendengue.mjs [--input <csv>] [--retrieved YYYY-MM-DD] [--recorded YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);

const input = resolve(args.input ?? "../data/processed/opendengue/ph_weekly_national_2012_2023.csv");
const output = resolve("src/data/opendengue-ph.json");

/** Verified in planning/OPENDENGUE_RECONCILIATION.md (§5–§8). */
const EXPECTED = {
  rows: 544,
  firstStart: "2012-12-30",
  lastEnd: "2023-11-25",
  geographyId: "ph",
  geographicLevel: "national",
  temporalResolution: "weekly",
  caseDefinition: "total",
  sum: 1_911_372,
  max: 21_743,
  min: 132,
};

/** Quote-aware CSV line split (fields may contain commas inside quotes). */
function splitCsvLine(line) {
  const out = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out;
}

const raw = readFileSync(input);
const sha256 = createHash("sha256").update(raw).digest("hex");
const text = raw.toString("utf8");
const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
const [header, ...lines] = withoutBom.split(/\r?\n/).filter(Boolean);
const columns = splitCsvLine(header);
const col = (name) => {
  const i = columns.indexOf(name);
  if (i < 0) throw new Error(`Missing column "${name}" in ${input}`);
  return i;
};
const C = Object.fromEntries(
  [
    "id",
    "disease_id",
    "geography_id",
    "geographic_level",
    "period_start",
    "period_end",
    "temporal_resolution",
    "metric",
    "case_definition",
    "value",
    "upstream_uuid",
    "upstream_source",
    "upstream_url",
  ].map((name) => [name, col(name)]),
);

const rows = lines
  .map((line) => {
    const f = splitCsvLine(line);
    const value = Number(f[C.value]);
    if (!Number.isFinite(value)) throw new Error(`Non-numeric value in row ${f[C.id]}`);
    return {
      id: f[C.id],
      diseaseId: f[C.disease_id],
      geographyId: f[C.geography_id],
      geographicLevel: f[C.geographic_level],
      periodStart: f[C.period_start],
      periodEnd: f[C.period_end],
      resolution: f[C.temporal_resolution],
      metric: f[C.metric],
      caseDefinition: f[C.case_definition],
      value,
      sourceRecordId: f[C.upstream_uuid],
      upstreamSource: f[C.upstream_source],
    };
  })
  .sort((a, b) => a.periodStart.localeCompare(b.periodStart));

// ---- Validation against the reconciliation (abort on any mismatch) ----
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};
const values = rows.map((r) => r.value);
const sum = values.reduce((a, b) => a + b, 0);
const max = Math.max(...values);
const min = Math.min(...values);
const unique = (key) => [...new Set(rows.map((r) => r[key]))];

check(rows.length === EXPECTED.rows, `row count ${rows.length} ≠ ${EXPECTED.rows}`);
check(rows[0]?.periodStart === EXPECTED.firstStart, `earliest ${rows[0]?.periodStart} ≠ ${EXPECTED.firstStart}`);
check(rows.at(-1)?.periodEnd === EXPECTED.lastEnd, `latest ${rows.at(-1)?.periodEnd} ≠ ${EXPECTED.lastEnd}`);
check(unique("geographyId").join() === EXPECTED.geographyId, `geographies ${unique("geographyId")}`);
check(unique("geographicLevel").join() === EXPECTED.geographicLevel, `levels ${unique("geographicLevel")}`);
check(unique("resolution").join() === EXPECTED.temporalResolution, `resolutions ${unique("resolution")}`);
check(unique("caseDefinition").join() === EXPECTED.caseDefinition, `case definitions ${unique("caseDefinition")}`);
check(unique("metric").join() === "cases", `metrics ${unique("metric")}`);
check(unique("diseaseId").join() === "dengue", `diseases ${unique("diseaseId")}`);
check(sum === EXPECTED.sum, `sum ${sum} ≠ ${EXPECTED.sum}`);
check(max === EXPECTED.max, `max ${max} ≠ ${EXPECTED.max}`);
check(min === EXPECTED.min, `min ${min} ≠ ${EXPECTED.min}`);
check(unique("periodStart").length === rows.length, "duplicate period starts");
check(unique("id").length === rows.length, "duplicate ids");
check(values.every((v) => v > 0), "zero or negative values present (possible zero-fill)");
check(
  rows.every((r) => (Date.parse(`${r.periodEnd}T00:00:00Z`) - Date.parse(`${r.periodStart}T00:00:00Z`)) / 86_400_000 === 6),
  "a row is not a 7-day period",
);

if (failures.length > 0) {
  console.error(`Validation failed for ${input}; ${output} NOT written:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

const upstreamUrls = [...new Set(lines.map((l) => splitCsvLine(l)[C.upstream_url]))];

const fixture = {
  meta: {
    source: "OpenDengue",
    version: "1.3",
    extract: "Temporal extract (WPRO)",
    filter: "ISO_A0 = PHL, T_res = Week, S_res = Admin0",
    upstreamUrl: upstreamUrls.length === 1 ? upstreamUrls[0] : null,
    citation: "Clarke J et al. Sci Data 2024;11:296. doi:10.6084/m9.figshare.24259573",
    license: "CC BY 4.0",
    file: `data/processed/opendengue/${basename(input)}`,
    sha256,
    reconciliation: "planning/OPENDENGUE_RECONCILIATION.md",
    retrievedAt: args.retrieved ?? "2026-09-24",
    recordedAt: args.recorded ?? new Date().toISOString().slice(0, 10),
    generator: "web/scripts/build-opendengue.mjs",
    validated: { rows: rows.length, firstStart: rows[0].periodStart, lastEnd: rows.at(-1).periodEnd, sum, max, min },
  },
  rows,
};

writeFileSync(output, `${JSON.stringify(fixture, null, 1)}\n`);
console.log(`Validated and wrote ${rows.length} weekly rows (sum ${sum}, max ${max}) to ${output}`);
console.log(`Input ${basename(input)} sha256 ${sha256}`);
