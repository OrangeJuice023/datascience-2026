#!/usr/bin/env node
/**
 * Downloads the ACCESS source files listed in sources.json into
 * data/raw/access/<dir>/, verifies SHA-256, and writes
 * data/raw/access/access-sources-manifest.json (url, sha256, bytes,
 * retrievedAt) for provenance.
 *
 *   node scripts/access/fetch-sources.mjs                    # download missing files, verify all
 *   node scripts/access/fetch-sources.mjs --force            # re-download; keeps the pinned file if it changed
 *   node scripts/access/fetch-sources.mjs --force --accept-changed   # replace a changed file (then re-pin)
 *
 * A re-download is written beside the pinned file first and only replaces it
 * when the hash matches, or when --accept-changed is given, so a verified
 * copy is never lost to an upstream change.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const rawDir = path.join(root, "data/raw/access");
const force = process.argv.includes("--force");
const acceptChanged = process.argv.includes("--accept-changed");
const { sources } = JSON.parse(fs.readFileSync(path.join(here, "sources.json"), "utf8"));
const manifestPath = path.join(rawDir, "access-sources-manifest.json");
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const USER_AGENT = "SIGMA-access-track/1.0 (PJDSC 2026 public-health prototype; github.com/OrangeJuice023/datascience-2026)";

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const manifest = {};
let failed = false;

for (const src of sources) {
  const dest = path.join(rawDir, src.dir, src.file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let retrievedAt = previous[src.id]?.retrievedAt ?? null;
  if (src.manual) {
    // No scripted download (the server refuses scripts); the file is saved by hand and still hash-checked.
    if (!fs.existsSync(dest)) {
      console.error(`✗ ${src.id}: ${src.manualNote ?? `download it by hand from ${src.url}`}`);
      failed = true;
      continue;
    }
  } else if (force || !fs.existsSync(dest)) {
    process.stdout.write(`Downloading ${src.id} … `);
    let res;
    try {
      res = await fetch(src.url, {
        redirect: "follow",
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      console.log(`failed (${error instanceof Error ? error.message : error})`);
      failed = true;
      continue;
    }
    if (!res.ok) {
      console.log(`HTTP ${res.status}`);
      failed = true;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const hash = sha256(buf);
    if (src.sha256 && hash !== src.sha256 && !acceptChanged && fs.existsSync(dest)) {
      const pending = `${dest}.changed`;
      fs.writeFileSync(pending, buf);
      console.log(`changed upstream (${hash.slice(0, 12)}…); kept the pinned file, new copy at ${path.relative(root, pending)}`);
      failed = true;
    } else {
      fs.writeFileSync(dest, buf);
      retrievedAt = new Date().toISOString();
      console.log("done");
    }
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
    file: path.posix.join("data/raw/access", src.dir, src.file),
    sha256: hash,
    bytes: buf.length,
    license: src.license,
    retrievedAt: retrievedAt ?? fs.statSync(dest).mtime.toISOString(),
  };
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Manifest → ${path.relative(root, manifestPath)}`);
if (failed) process.exit(1);
