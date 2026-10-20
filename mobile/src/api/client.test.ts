import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, toQuery } from "./client";

/**
 * The client is the only thing standing between a bad response and a screen
 * that misreports what the API said. These tests pin the mapping from HTTP
 * reality to `ApiError`, because a screen can only show a useful message if
 * the client tells it what went wrong.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const META = { apiVersion: "v1", generatedAt: "2026-10-19T00:00:00.000Z", status: "live", isSample: false };

describe("apiRequest", () => {
  it("returns the envelope of a successful response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { ok: true }, meta: META }));

    const result = await apiRequest<{ ok: boolean }>("http://localhost:3000/api/v1", "/health");

    expect(result.data).toEqual({ ok: true });
    expect(result.meta.status).toBe("live");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("turns an error body into an ApiError that keeps the server's message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: { code: "bad_request", message: '"limit" must be between 1 and 2000.', details: { limit: ["out of range"] } },
          meta: { ...META, status: "unavailable" },
        },
        400,
      ),
    );

    await expect(apiRequest("http://localhost:3000/api/v1", "/dengue/observations")).rejects.toMatchObject({
      code: "bad_request",
      status: 400,
      message: '"limit" must be between 1 and 2000.',
    });
  });

  it("treats a non-2xx response with an unreadable body as a failure", async () => {
    fetchMock.mockResolvedValue(new Response("<html>gateway error</html>", { status: 502 }));

    await expect(apiRequest("http://localhost:3000/api/v1", "/health")).rejects.toMatchObject({
      code: "http_error",
      status: 502,
    });
  });

  it("rejects a 200 response that is not in the envelope shape", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ unexpected: true }));

    await expect(apiRequest("http://localhost:3000/api/v1", "/health")).rejects.toMatchObject({
      code: "malformed_response",
    });
  });

  it("rejects a body that is not JSON at all", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(apiRequest("http://localhost:3000/api/v1", "/health")).rejects.toMatchObject({
      code: "malformed_response",
    });
  });

  it("reports an unreachable server as a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    let caught: unknown;
    try {
      await apiRequest("http://localhost:3000/api/v1", "/health");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const error = caught as ApiError;
    expect(error.code).toBe("network_error");
    expect(error.isNetworkError).toBe(true);
    expect(error.message).toMatch(/Check the API address in Settings/i);
  });

  it("reports an aborted request as a timeout", async () => {
    const aborted = new Error("The operation was aborted.");
    aborted.name = "AbortError";
    fetchMock.mockRejectedValue(aborted);

    await expect(apiRequest("http://localhost:3000/api/v1", "/health")).rejects.toMatchObject({
      code: "timeout",
    });
  });

  it("sends a JSON body for a POST request", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { reply: "hello" }, meta: META }));

    await apiRequest("http://localhost:3000/api/v1", "/chat", { method: "POST", body: { message: "hi" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ message: "hi" }));
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });
});

describe("toQuery", () => {
  it("returns an empty string when nothing is set", () => {
    expect(toQuery({ from: undefined, limit: undefined })).toBe("");
  });

  it("keeps defined values and drops the rest", () => {
    expect(toQuery({ disease: "dengue", limit: undefined })).toBe("?disease=dengue");
  });

  it("encodes values that need it", () => {
    expect(toQuery({ from: "2020-01-05" })).toBe("?from=2020-01-05");
  });
});
