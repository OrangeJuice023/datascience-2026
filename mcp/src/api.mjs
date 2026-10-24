/**
 * Minimal client for the SIGMA REST API (web/src/app/api/v1).
 *
 * Every SIGMA response is an envelope: `{ data, meta: { status, isSample, ... } }`
 * on success, `{ error: { code, message, details? } }` on failure. The MCP tools
 * pass `meta.status` and `meta.isSample` through to the model unchanged, so a
 * demo or not-connected answer can never be read as live data.
 */

export const DEFAULT_BASE_URL = "https://datascience-2026.vercel.app/api/v1";
export const TIMEOUT_MS = 20_000;

export function baseUrlFromEnv(env = process.env) {
  return (env.SIGMA_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/** `/dengue/signals` + `{ week: "2019-07-14", locationId: undefined }` -> `/dengue/signals?week=2019-07-14`. */
export function buildPath(path, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export class SigmaApiError extends Error {
  constructor(code, status, message, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** GET one SIGMA endpoint; resolves to the envelope `{ data, meta }`. */
export async function sigmaGet(baseUrl, path, query, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const url = `${baseUrl}${buildPath(path, query)}`;
  let response;
  try {
    response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new SigmaApiError(timedOut ? "timeout" : "network_error", 0,
      `${timedOut ? "Timed out reaching" : "Could not reach"} the SIGMA API at ${baseUrl}.`);
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    // handled below
  }
  if (!response.ok || !body || body.error) {
    const err = body?.error;
    throw new SigmaApiError(err?.code ?? "http_error", response.status,
      err?.message ?? `The SIGMA API answered ${response.status} without a readable body.`, err?.details);
  }
  if (!("data" in body) || !body.meta) {
    throw new SigmaApiError("bad_response", response.status, "The SIGMA API answered without a data/meta envelope.");
  }
  return body;
}
