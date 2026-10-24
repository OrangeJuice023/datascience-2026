import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { NextRequest } from "next/server";
import type { DataStatus } from "@sigma/contracts";
import { describe, expect, it } from "vitest";

import { GET as indexGet } from "@/app/api/v1/route";
import { GET as accessGet } from "@/app/api/v1/access/metrics/route";
import { GET as accessUnitsGet } from "@/app/api/v1/access/units/route";
import { GET as accessMedicinesGet } from "@/app/api/v1/access/medicines/route";
import { GET as evidenceGet } from "@/app/api/v1/policy/evidence/route";
import { GET as healthGet } from "@/app/api/v1/health/route";
import { GET as observationsGet } from "@/app/api/v1/dengue/observations/route";
import { GET as policyInfoGet } from "@/app/api/v1/policy/info/route";
import { GET as signalsGet } from "@/app/api/v1/dengue/signals/route";
import { GET as sourcesGet } from "@/app/api/v1/sources/route";
import { GET as summaryGet } from "@/app/api/v1/dengue/summary/route";
import { GET as dengueUnitsGet } from "@/app/api/v1/dengue/units/route";
import { POST as chatPost } from "@/app/api/v1/chat/route";
import {
  API_ENDPOINTS,
  STATUS_GLOSSARY,
  findEndpoint,
  type ApiEndpoint,
} from "./registry";

/**
 * The registry is the documentation.
 *
 * These tests are what stop it from becoming a second, stale copy of the
 * API:
 *
 * 1. The registry must describe exactly the route files that exist on disk.
 * 2. Every documented status and sample flag must match the real handler.
 * 3. Every documented example must be a true subset of a real response.
 * 4. The glossary may only name statuses the shared contract allows.
 */

const THIS_FILE = dirname(fileURLToPath(import.meta.url));
/** The `web/` root, resolved from this file rather than from the cwd. */
const WEB_ROOT = join(THIS_FILE, "..", "..", "..");
const API_ROOT = join(WEB_ROOT, "src", "app", "api", "v1");
const CONTRACT_STATUSES: DataStatus[] = ["live", "demo", "unavailable", "not_connected"];

interface DiscoveredRoute {
  method: string;
  path: string;
  file: string;
}

/**
 * Walks the API route tree and reads the HTTP methods each file exports.
 *
 * A route file may also export a method that only rejects the request —
 * `export const GET = methodNotAllowed(["POST"])` — which is not an endpoint
 * of its own. Those are collected separately, because the endpoint that owns
 * them has to document the 405.
 */
function discoverRoutes(): { endpoints: DiscoveredRoute[]; rejections: DiscoveredRoute[] } {
  const endpoints: DiscoveredRoute[] = [];
  const rejections: DiscoveredRoute[] = [];

  function walk(directory: string, segments: string[]) {
    for (const entry of readdirSync(directory)) {
      const full = join(directory, entry);
      if (statSync(full).isDirectory()) {
        walk(full, [...segments, entry]);
        continue;
      }
      if (!entry.endsWith("route.ts")) continue;
      const source = readFileSync(full, "utf8");
      const path = segments.length === 0 ? "" : `/${segments.join("/")}`;
      for (const match of source.matchAll(
        /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*([^;]+);/g,
      )) {
        const method = match[1];
        const initializer = match[2];
        const route = {
          method,
          path,
          file: relative(WEB_ROOT, full).split(sep).join("/"),
        };
        if (initializer.includes("methodNotAllowed")) {
          rejections.push(route);
        } else {
          endpoints.push(route);
        }
      }
    }
  }

  walk(API_ROOT, []);
  return { endpoints, rejections };
}

function request(path: string, search = "") {
  return new NextRequest(`http://localhost/api/v1${path}${search}`);
}

/**
 * Is the documented example a true subset of the real response?
 *
 * Objects must match key for key; arrays are compared element by element so a
 * trimmed example can be a prefix; scalars must be equal. This is what makes
 * "trimmed for length" an honest claim rather than a convenient one.
 */
function isSubset(documented: unknown, real: unknown, path = "data"): string | null {
  if (documented === null || documented === undefined) {
    return real === documented ? null : `${path}: expected ${String(real)}, got ${String(documented)}`;
  }
  if (Array.isArray(documented)) {
    if (!Array.isArray(real)) return `${path}: expected an array`;
    if (documented.length > real.length) {
      return `${path}: documented ${documented.length} items, real response has ${real.length}`;
    }
    for (let index = 0; index < documented.length; index += 1) {
      const problem = isSubset(documented[index], real[index], `${path}[${index}]`);
      if (problem) return problem;
    }
    return null;
  }
  if (typeof documented === "object") {
    if (typeof real !== "object" || real === null) return `${path}: expected an object`;
    const documentedRecord = documented as Record<string, unknown>;
    const realRecord = real as Record<string, unknown>;
    for (const key of Object.keys(documentedRecord)) {
      if (!(key in realRecord)) return `${path}.${key}: not present in the real response`;
      const problem = isSubset(documentedRecord[key], realRecord[key], `${path}.${key}`);
      if (problem) return problem;
    }
    return null;
  }
  if (documented !== real) {
    return `${path}: documented ${JSON.stringify(documented)}, real ${JSON.stringify(real)}`;
  }
  return null;
}

/** The part of a response body the registry compares against. */
interface ParsedBody {
  data: unknown;
  meta: { apiVersion: string; generatedAt: string; status: string; isSample: boolean };
  error?: { code: string; message: string; details?: Record<string, string[]> };
}

/** Calls the real handler for an endpoint and returns its parsed body. */
async function callRealHandler(
  endpoint: ApiEndpoint,
): Promise<{ status: number; body: ParsedBody }> {
  switch (`${endpoint.method} ${endpoint.path}`) {
    case "GET /":
      return { status: 200, body: await (await indexGet(request(""))).json() };
    case "GET /health":
      return { status: 200, body: await (await healthGet(request("/health"))).json() };
    case "GET /sources":
      return { status: 200, body: await (await sourcesGet(request("/sources"))).json() };
    case "GET /dengue/observations":
      return {
        status: 200,
        body: await (await observationsGet(request("/dengue/observations", "?limit=2"))).json(),
      };
    case "GET /dengue/summary":
      return {
        status: 200,
        body: await (await summaryGet(request("/dengue/summary", "?limit=2"))).json(),
      };
    case "GET /dengue/signals":
      return { status: 200, body: await (await signalsGet(request("/dengue/signals"))).json() };
    case "GET /dengue/units":
      return {
        status: 200,
        body: await (await dengueUnitsGet(request("/dengue/units", "?unitId=quezon-city"))).json(),
      };
    case "GET /access/metrics":
      return {
        status: 200,
        body: await (await accessGet(request("/access/metrics", "?limit=2"))).json(),
      };
    case "GET /access/units":
      return {
        status: 200,
        body: await (await accessUnitsGet(request("/access/units", "?unitId=quezon-city"))).json(),
      };
    case "GET /access/medicines":
      return { status: 200, body: await (await accessMedicinesGet(request("/access/medicines"))).json() };
    case "GET /policy/info":
      return { status: 200, body: await (await policyInfoGet(request("/policy/info"))).json() };
    case "GET /policy/evidence":
      return {
        status: 200,
        body: await (await evidenceGet(request("/policy/evidence"))).json(),
      };
    default:
      throw new Error(`No real handler wired for ${endpoint.method} ${endpoint.path}`);
  }
}

describe("the endpoint registry", () => {
  it("describes every route file that exists on disk, and nothing else", () => {
    const { endpoints: discovered } = discoverRoutes();
    const documented = API_ENDPOINTS.map(
      (endpoint) => `${endpoint.method} ${endpoint.path === "/" ? "/" : endpoint.path}`,
    );

    expect(documented.slice().sort()).toEqual(discovered.map((r) => `${r.method} ${r.path || "/"}`).sort());
  });

  it("documents a 405 for every method a route file only rejects", () => {
    const { rejections } = discoverRoutes();

    for (const rejection of rejections) {
      const owner = API_ENDPOINTS.find(
        (endpoint) => endpoint.path === (rejection.path || "/") && endpoint.method !== rejection.method,
      );
      expect(owner, `${rejection.file} rejects ${rejection.method} but owns no other method`).toBeDefined();
      expect(
        owner?.errors.some(
          (error) => error.code === "method_not_allowed" && error.status === 405,
        ),
        `${owner?.method} ${owner?.path} must document a 405 for the rejected method`,
      ).toBe(true);
    }
  });

  it("keeps the registry and the machine-readable index in step", async () => {
    const body = await (await indexGet(request(""))).json();

    const fromRegistry = API_ENDPOINTS.filter((endpoint) => endpoint.listedInIndex).map(
      (endpoint) => ({
        method: endpoint.method,
        path: `/api/v1${endpoint.path}`,
        description: endpoint.summary,
      }),
    );

    expect(body.data.endpoints).toEqual(fromRegistry);
  });

  it("keeps the documented summary of every indexed endpoint", async () => {
    const body = await (await indexGet(request(""))).json();
    const summaries = new Map(API_ENDPOINTS.map((e) => [e.path, e.summary]));

    for (const entry of body.data.endpoints) {
      const path = entry.path.replace("/api/v1", "") || "/";
      expect(entry.description).toBe(summaries.get(path));
    }
  });
});

describe("every documented endpoint matches its real handler", () => {
  for (const endpoint of API_ENDPOINTS) {
    if (endpoint.method === "POST") continue;

    it(`${endpoint.method} ${endpoint.path} returns the documented status and sample flag`, async () => {
      const { body } = await callRealHandler(endpoint);

      expect(body.meta.status).toBe(endpoint.status);
      expect(body.meta.isSample).toBe(endpoint.isSample);
      expect(endpoint.possibleStatuses).toContain(endpoint.status);
    });

    it(`${endpoint.method} ${endpoint.path} has an example that is a true subset of the real response`, async () => {
      const { body } = await callRealHandler(endpoint);
      const example = endpoint.exampleResponse as { data: unknown; meta: Record<string, unknown> };

      const problem = isSubset(example.data, body.data);
      expect(problem).toBeNull();

      expect(example.meta.status).toBe(body.meta.status);
      expect(example.meta.isSample).toBe(body.meta.isSample);
      expect(example.meta.apiVersion).toBe(body.meta.apiVersion);
    });
  }
});

describe("the copilot endpoint", () => {
  const chat = findEndpoint("POST", "/chat");

  it("is documented", () => {
    expect(chat).toBeDefined();
  });

  it("refuses the request when no model provider is configured", async () => {
    // The CI environment has no provider key, so the documented
    // `not_configured` refusal is what actually happens.
    const response = await chatPost(
      new NextRequest("http://localhost/api/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(chat?.example.body ?? {}),
      }),
    );
    const body = await response.json();

    if (response.status === 503) {
      expect(body.error.code).toBe("not_configured");
      expect(body.meta.status).toBe("unavailable");
      expect(chat?.errors.some((error) => error.code === "not_configured")).toBe(true);
      return;
    }

    // A provider is configured: the documented success shape must hold.
    expect(response.status).toBe(200);
    expect(body.meta.status).toBe(chat?.status);
    expect(body.meta.isSample).toBe(chat?.isSample);
    expect(body.data).toHaveProperty("reply");
    expect(body.data).toHaveProperty("model");
    expect(body.data).toHaveProperty("contextScope");
    expect(body.data).toHaveProperty("limitations");
  });
});

describe("the data-status glossary", () => {
  it("only names statuses the shared contract allows", () => {
    for (const entry of STATUS_GLOSSARY) {
      expect(CONTRACT_STATUSES).toContain(entry.status);
    }
  });

  it("covers every status in the contract exactly once", () => {
    expect(STATUS_GLOSSARY.map((entry) => entry.status).sort()).toEqual(
      [...CONTRACT_STATUSES].sort(),
    );
  });

  it("does not claim the API can return a status the contract does not define", () => {
    for (const endpoint of API_ENDPOINTS) {
      for (const status of endpoint.possibleStatuses) {
        expect(CONTRACT_STATUSES).toContain(status);
      }
    }
  });
});
