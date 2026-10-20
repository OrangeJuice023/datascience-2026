import { describe, expect, it } from "vitest";
import { ApiError, buildMeta, errorResponse, success, toApiError } from "./envelope";

/**
 * The envelope is the API's contract with every client, including the mobile
 * app. These tests pin the two shapes and, just as importantly, pin what a
 * response must never contain.
 */

describe("success envelope", () => {
  it("wraps the payload with version, timestamp, status and sample flag", () => {
    const body = success({ value: 1 }, { status: "live", isSample: false, now: new Date("2026-01-01T00:00:00Z") });

    expect(body.data).toEqual({ value: 1 });
    expect(body.meta).toEqual({
      apiVersion: "v1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      status: "live",
      isSample: false,
    });
  });

  it("uses an injected clock so responses are deterministic under test", () => {
    const meta = buildMeta({ status: "demo", isSample: true, now: new Date("2026-05-05T12:00:00Z") });
    expect(meta.generatedAt).toBe("2026-05-05T12:00:00.000Z");
    expect(meta.isSample).toBe(true);
  });
});

describe("error envelope", () => {
  it("carries the code, the message and the field-level details", () => {
    const body = errorResponse(ApiError.badRequest('"limit" must be between 1 and 2000.', { limit: ["out of range"] }), {
      status: "unavailable",
      isSample: false,
    });

    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe('"limit" must be between 1 and 2000.');
    expect(body.error.details).toEqual({ limit: ["out of range"] });
    expect(body.meta.status).toBe("unavailable");
  });

  it("carries the retry delay when the request was rate limited", () => {
    const body = errorResponse(ApiError.rateLimited("Too many requests.", 30), {
      status: "unavailable",
      isSample: false,
    });

    expect(body.error.code).toBe("rate_limited");
    expect(body.error.retryAfterSeconds).toBe(30);
  });

  it("never leaks an internal exception", () => {
    const internal = new Error("ENOENT: D:\\SIGMA\\data\\raw\\secret.csv");
    const body = errorResponse(toApiError(internal), { status: "unavailable", isSample: false });

    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("secret.csv");
    expect(body.error.message).not.toContain("D:\\SIGMA");
    expect(Object.keys(body.error)).not.toContain("stack");
  });

  it("keeps a client-safe ApiError exactly as it was written", () => {
    const original = ApiError.notFound('No series named "measles".');
    const normalised = toApiError(original);

    expect(normalised).toBe(original);
    expect(normalised.status).toBe(404);
  });
});
