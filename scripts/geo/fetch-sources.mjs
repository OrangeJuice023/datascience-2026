#!/usr/bin/env node
/**
 * Downloads the geography-track source files listed in sources.json into
 * data/raw/<dir>/, verifies SHA-256, and writes data/raw/geo-sources-manifest.json
 * (url, sha256, bytes, retrievedAt) for provenance.
 *
 *   node scripts/geo/fetch-sources.mjs            # download missing files, verify all
 *   node scripts/geo/fetch-sources.mjs --force    # re-download everything
 *
 * Files already on disk are not re-downloaded unless --force; they are still hashed.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const rawDir = path.join(root, "data/raw");
const force = process.argv.includes("--force");
const { sources } = JSON.parse(fs.readFileSync(path.join(here, "sources.json"), "utf8"));
const manifestPath = path.join(rawDir, "geo-sources-manifest.json");
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const manifest = {};
let failed = false;

for (const src of sources) {
  const dest = path.join(rawDir, src.dir, src.file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let retrievedAt = previous[src.id]?.retrievedAt ?? null;
  if (force || !fs.existsSync(dest)) {
    process.stdout.write(`Downloading ${src.id} … `);
    const res = await fetch(src.url, { redirect: "follow" });
    if (!res.ok) {
      console.log(`HTTP ${res.status}`);
      failed = true;
      continue;
    }
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    retrievedAt = new Date().toISOString();
    console.log("done");
  }
  const buf = fs.readFileSync(dest);
  const hash = sha256(buf);
  if (src.sha256 && hash !== src.sha256) {
    console.error(`✗ ${src.id}: SHA-256 ${hash} does not match sources.json (${src.sha256}). Upstream changed?`);
    failed = true;
  } else {
    console.log(`✓ ${src.id} ${hash.slice(0, 12)}… ${buf.length} bytes`);
  }
  manifest[src.id] = {
    url: src.url,
    file: path.posix.join("data/raw", src.dir, src.file),
    sha256: hash,
    bytes: buf.length,
    license: src.license,
    // Files fetched before this script existed keep the date they were first retrieved.
    retrievedAt: retrievedAt ?? "2026-10-17T01:19:00+08:00",
  };
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Manifest → ${path.relative(root, manifestPath)}`);
if (failed) process.exit(1);
