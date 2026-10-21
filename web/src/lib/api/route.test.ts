import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { ApiError } from "./envelope";
import { methodNotAllowed, withErrors } from "./route";

/**
 * The route wrapper is the only place where an exception becomes a response.
 * What matters here is that a client always gets the standard envelope, with
 * a status code that matches the failure, and that nothing internal leaks.
 */

function stubRequest(method = "GET"): NextRequest {
  return { method } as unknown as NextRequest;
}

describe("withErrors", () => {
  it("wraps a successful handler in the success envelope", async () => {
    const route = withErrors(async () => ({ data: { hello: "world" }, status: "live" as const, isSample: false }));

    const response = await route(stubRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ hello: "world" });
    expect(body.meta.status).toBe("live");
    expect(body.meta.isSample).toBe(false);
    expect(body.meta.apiVersion).toBe("v1");
  });

  it("keeps the demo flag so a simulated payload is never mistaken for a live one", async () => {
    const route = withErrors(async () => ({ data: [], status: "demo" as const, isSample: true }));

    const body = await (await route(stubRequest())).json();

    expect(body.meta.status).toBe("demo");
    expect(body.meta.isSample).toBe(true);
  });

  it("turns a client error into the matching status code", async () => {
    const route = withErrors(async () => {
      throw ApiError.badRequest("bad input", { field: ["invalid"] });
    });

    const response = await route(stubRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("bad_request");
    expect(body.error.details).toEqual({ field: ["invalid"] });
    expect(body.meta.status).toBe("unavailable");
  });

  it("turns an unknown exception into a 500 that discloses nothing", async () => {
    const route = withErrors(async () => {
      throw new Error("Cannot read properties of undefined (reading 'value') at C:\\SIGMA\\web\\src\\lib\\api\\dengue.ts");
    });

    const response = await route(stubRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("SIGMA");
    expect(body.error.message).not.toContain("dengue.ts");
  });

  it("sets the Retry-After header when the request was rate limited", async () => {
    const route = withErrors(async () => {
      throw ApiError.rateLimited("Too many requests.", 42);
    });

    const response = await route(stubRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
  });
});

describe("methodNotAllowed", () => {
  it("answers 405 and states which methods are allowed", async () => {
    const response = await methodNotAllowed(["GET"])(stubRequest("POST"));
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(body.error.code).toBe("method_not_allowed");
  });
});
