/** Small RFC 4180 CSV reader/writer (quoted fields, embedded commas/quotes/newlines). */
import fs from "node:fs";

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** CSV file → array of objects keyed by the first row. */
export function readCsvRecords(file) {
  const [header, ...rows] = parseCsv(fs.readFileSync(file, "utf8"));
  return rows
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const quote = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Writes objects as CSV with the given column order, LF line endings. */
export function writeCsv(file, columns, records) {
  const lines = [columns.join(","), ...records.map((r) => columns.map((c) => quote(r[c])).join(","))];
  fs.writeFileSync(file, lines.join("\n") + "\n");
}
