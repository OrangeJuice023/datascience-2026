import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

/**
 * Route-level contract tests.
 *
 * These exercise the real handler against the real committed data fixture,
 * so they cover the whole path: parameter validation, the provider, the
 * service layer and the envelope. The fixture is a validated build artefact
 * committed to the repository, so the assertions are deterministic.
 */

function request(search = ""): NextRequest {
  return new NextRequest(`http://localhost/api/v1/dengue/observations${search}`);
}

describe("GET /api/v1/dengue/observations", () => {
  it("returns the observation series in the success envelope", async () => {
    const response = await GET(request("?limit=5"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.apiVersion).toBe("v1");
    expect(body.meta.status).toBe("live");
    expect(body.meta.isSample).toBe(false);
    expect(body.data.observations.length).toBeLessThanOrEqual(5);
    expect(body.data.series.coverage.from).toBe("2012-12-30");
    expect(body.data.series.coverage.to).toBe("2023-11-25");
  });

  it("never returns a value for a week the source does not have", async () => {
    const body = await (await GET(request("?limit=2000"))).json();
    const periods = body.data.observations.map((o: { periodStart: string }) => o.periodStart);
    const unique = new Set(periods);

    expect(unique.size).toBe(periods.length);
    for (const observation of body.data.observations) {
      expect(observation.value).toBeGreaterThanOrEqual(0);
    }
  });

  it("rejects an unknown query parameter", async () => {
    const response = await GET(request("?limitt=5"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("bad_request");
  });

  it("rejects a limit outside the allowed range", async () => {
    const response = await GET(request("?limit=99999"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.details.limit).toBeDefined();
  });

  it("rejects a reversed date range", async () => {
    const response = await GET(request("?from=2021-01-01&to=2020-01-01"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("bad_request");
  });

  it("refuses a disease that has no connected series", async () => {
    const response = await GET(request("?disease=measles"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});
