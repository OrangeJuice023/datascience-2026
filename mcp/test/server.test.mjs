import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { baseUrlFromEnv, buildPath, DEFAULT_BASE_URL } from "../src/api.mjs";
import { createServer } from "../src/server.mjs";
import { TOOLS } from "../src/tools.mjs";

const BASE = "http://sigma.test/api/v1";

/** A fake fetch that records URLs and answers from a routing function. */
function fakeFetch(route) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const { status = 200, body } = route(url);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { impl, calls };
}

async function connect(fetchImpl) {
  const server = createServer({ baseUrl: BASE, fetchImpl });
  const client = new Client({ name: "test", version: "0.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

const live = (data) => ({ body: { data, meta: { apiVersion: "v1", status: "live", isSample: false, generatedAt: "2026-10-24T00:00:00Z" } } });

test("buildPath drops empty values and encodes the rest", () => {
  assert.equal(buildPath("/dengue/signals", { week: "2019-07-14", locationId: undefined, x: "" }), "/dengue/signals?week=2019-07-14");
  assert.equal(buildPath("/health"), "/health");
});

test("base URL defaults to the deployed API and honours SIGMA_API_BASE_URL", () => {
  assert.equal(baseUrlFromEnv({}), DEFAULT_BASE_URL);
  assert.equal(baseUrlFromEnv({ SIGMA_API_BASE_URL: "http://localhost:3000/api/v1/" }), "http://localhost:3000/api/v1");
});

test("lists every tool as read-only, without chat or the retired metrics endpoint", async () => {
  const client = await connect(fakeFetch(() => live({})).impl);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), TOOLS.map((t) => t.name).sort());
  assert.ok(tools.every((t) => t.annotations?.readOnlyHint === true));
  assert.ok(!TOOLS.some((t) => t.path === "/chat" || t.path === "/access/metrics"));
});

test("calls the right endpoint and passes provenance through", async () => {
  const fake = fakeFetch(() => live({ signals: [{ geographyId: "iloilo-city", method: "EARS C2", value: 19, alarm: true }] }));
  const client = await connect(fake.impl);
  const res = await client.callTool({ name: "dengue_signals", arguments: { locationId: "iloilo-city", week: "2019-07-14" } });
  assert.equal(fake.calls[0], `${BASE}/dengue/signals?locationId=iloilo-city&week=2019-07-14`);
  assert.ok(!res.isError);
  assert.match(res.content[0].text, /status: live; isSample: false/);
  assert.match(res.content[0].text, /"iloilo-city"/);
});

test("flags demo and not-connected answers so they cannot pass as live data", async () => {
  const client = await connect(fakeFetch(() => ({ body: { data: {}, meta: { status: "not_connected", isSample: true } } })).impl);
  const res = await client.callTool({ name: "sigma_health", arguments: {} });
  assert.match(res.content[0].text, /not live data/);
  assert.match(res.content[0].text, /demo data/);
});

test("turns an API error envelope into a tool error with its details", async () => {
  const client = await connect(fakeFetch(() => ({
    status: 400,
    body: { error: { code: "bad_request", message: 'Unknown reporting unit "atlantis".', details: { unitId: ["unknown reporting unit"] } } },
  })).impl);
  const res = await client.callTool({ name: "dengue_units", arguments: { unitId: "atlantis" } });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /bad_request, HTTP 400/);
  assert.match(res.content[0].text, /unknown reporting unit/);
});

test("rejects a malformed week before calling the API", async () => {
  const fake = fakeFetch(() => live({}));
  const client = await connect(fake.impl);
  const res = await client.callTool({ name: "dengue_signals", arguments: { week: "14/07/2019" } }).catch((e) => ({ isError: true, content: [{ text: String(e) }] }));
  assert.equal(res.isError, true);
  assert.equal(fake.calls.length, 0);
});

test("reports an unreachable API as a network error, not as empty data", async () => {
  const client = await connect(async () => {
    throw new TypeError("fetch failed");
  });
  const res = await client.callTool({ name: "access_medicines", arguments: {} });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /network_error/);
});
