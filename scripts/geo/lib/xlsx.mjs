/**
 * Minimal, dependency-free .xlsx reader (Node >= 20).
 *
 * Reads the zip central directory, inflates the parts it needs with zlib and
 * returns each worksheet as an array of rows (arrays of strings or null).
 * Cell values are returned as stored: numbers and dates stay as their raw
 * string form; callers decide how to interpret them. Formulas return their
 * cached value.
 */
import fs from "node:fs";
import zlib from "node:zlib";

function readZip(buffer) {
  // End of central directory record: signature 0x06054b50, searched from the end.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip file (no end-of-central-directory record)");
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < entryCount; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Corrupt central directory");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.set(name, { method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return {
    has: (name) => entries.has(name),
    text(name) {
      const entry = entries.get(name);
      if (!entry) throw new Error(`Missing zip entry: ${name}`);
      const local = entry.localOffset;
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + entry.compressedSize);
      if (entry.method === 0) return data.toString("utf8");
      if (entry.method === 8) return zlib.inflateRawSync(data).toString("utf8");
      throw new Error(`Unsupported zip compression method ${entry.method} for ${name}`);
    },
  };
}

const unescapeXml = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");

const textRuns = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join("");

function columnIndex(ref) {
  let n = 0;
  for (const c of ref.match(/^[A-Z]+/)[0]) n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
}

/** @returns {Map<string, Array<Array<string|null>>>} sheet name → rows */
export function readWorkbook(filePath, { sheets: wanted } = {}) {
  const zip = readZip(fs.readFileSync(filePath));
  const shared = zip.has("xl/sharedStrings.xml")
    ? [...zip.text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1]))
    : [];
  const rels = Object.fromEntries(
    [...zip.text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
      m[0].match(/Id="([^"]+)"/)[1],
      m[0].match(/Target="([^"]+)"/)[1],
    ]),
  );
  const result = new Map();
  for (const m of zip.text("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)) {
    const name = unescapeXml(m[0].match(/name="([^"]+)"/)[1]);
    if (wanted && !wanted.includes(name)) continue;
    const target = rels[m[0].match(/r:id="([^"]+)"/)[1]].replace(/^\/?(xl\/)?/, "xl/");
    const rows = [];
    for (const r of zip.text(target).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = c[1].match(/r="([^"]+)"/)[1];
        const type = (c[1].match(/t="([^"]+)"/) || [])[1];
        const body = c[2] || "";
        let value = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (type === "s") value = shared[Number(value)];
        else if (type === "inlineStr") value = textRuns(body);
        else if (value !== undefined) value = unescapeXml(value);
        row[columnIndex(ref)] = value ?? null;
      }
      rows.push(Array.from(row, (v) => v ?? null));
    }
    result.set(name, rows);
  }
  return result;
}

/** Rows → objects keyed by the header row at `headerIndex`. Blank rows are dropped. */
export function toRecords(rows, headerIndex = 0) {
  const header = rows[headerIndex];
  return rows
    .slice(headerIndex + 1)
    .filter((r) => r.some((v) => v !== null && v !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])));
}
