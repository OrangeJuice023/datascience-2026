import { describe, expect, it } from "vitest";
import { ApiError } from "./envelope";
import { assertKnownParams, LIMITS, parseDateOption, parseEnumOption, parseIdOption, parseIntOption, parseQuery } from "./query";

/**
 * Query validation is the API's first line of defence: a typo in a parameter
 * name must surface as an error rather than being silently ignored, and no
 * single request may pull an unbounded payload.
 */

function queryOf(search: string) {
  return parseQuery(new URL(`http://localhost/api/v1/dengue/observations${search}`));
}

describe("assertKnownParams", () => {
  it("accepts the parameters the endpoint documents", () => {
    expect(() => assertKnownParams(queryOf("?disease=dengue&from=2020-01-01&limit=10"), ["disease", "from", "to", "limit"])).not.toThrow();
  });

  it("rejects an unknown parameter and names it", () => {
    try {
      assertKnownParams(queryOf("?limitt=10"), ["disease", "from", "to", "limit"]);
      expect.unreachable("an unknown parameter must be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(400);
      expect(apiError.code).toBe("bad_request");
      expect(apiError.message).toContain("limitt");
      expect(apiError.details?.unknown).toEqual(["limitt"]);
    }
  });

  it("lists every unknown parameter once", () => {
    try {
      assertKnownParams(queryOf("?a=1&b=2&a=3"), ["disease"]);
      expect.unreachable("an unknown parameter must be rejected");
    } catch (error) {
      expect((error as ApiError).details?.unknown).toEqual(["a", "b"]);
    }
  });
});

describe("parseIntOption", () => {
  const range = { min: 1, max: LIMITS.maxObservations, fallback: LIMITS.maxObservations };

  it("falls back when the parameter is absent or empty", () => {
    expect(parseIntOption(queryOf(""), "limit", range)).toBe(LIMITS.maxObservations);
    expect(parseIntOption(queryOf("?limit="), "limit", range)).toBe(LIMITS.maxObservations);
  });

  it("accepts a whole number inside the range", () => {
    expect(parseIntOption(queryOf("?limit=25"), "limit", range)).toBe(25);
  });

  it("rejects a number that is not an integer", () => {
    try {
      parseIntOption(queryOf("?limit=2.5"), "limit", range);
      expect.unreachable("a non-integer limit must be rejected");
    } catch (error) {
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).details?.limit).toEqual(["not an integer"]);
    }
  });

  it("rejects a number outside the range", () => {
    try {
      parseIntOption(queryOf("?limit=0"), "limit", range);
      expect.unreachable("an out-of-range limit must be rejected");
    } catch (error) {
      expect((error as ApiError).details?.limit).toEqual([`out of range (${range.min}–${range.max})`]);
    }
  });
});

describe("parseDateOption", () => {
  it("returns undefined when absent", () => {
    expect(parseDateOption(queryOf(""), "from")).toBeUndefined();
  });

  it("accepts an ISO date", () => {
    expect(parseDateOption(queryOf("?from=2020-01-05"), "from")?.value).toBe("2020-01-05");
  });

  it("rejects a non-ISO date", () => {
    try {
      parseDateOption(queryOf("?from=05/01/2020"), "from");
      expect.unreachable("a non-ISO date must be rejected");
    } catch (error) {
      expect((error as ApiError).details?.from).toEqual(["not an ISO date"]);
    }
  });

  it("rejects a well-formed but impossible date", () => {
    try {
      parseDateOption(queryOf("?from=2020-02-31"), "from");
      expect.unreachable("an impossible date must be rejected");
    } catch (error) {
      expect((error as ApiError).status).toBe(400);
    }
  });
});

describe("parseEnumOption", () => {
  it("accepts an allowed value", () => {
    expect(parseEnumOption(queryOf("?disease=dengue"), "disease", ["dengue", "chikungunya"])).toBe("dengue");
  });

  it("rejects a value that is not allowed", () => {
    try {
      parseEnumOption(queryOf("?disease=measles"), "disease", ["dengue", "chikungunya"]);
      expect.unreachable("an unsupported value must be rejected");
    } catch (error) {
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).message).toContain("dengue");
    }
  });
});

describe("parseIdOption", () => {
  it("returns undefined when absent", () => {
    expect(parseIdOption(queryOf(""), "locationIds", ["quezon-city"])).toBeUndefined();
  });

  it("rejects an unknown id with 404, not 400", () => {
    try {
      parseIdOption(queryOf("?locationIds=nowhere"), "locationIds", ["quezon-city"]);
      expect.unreachable("an unknown id must be rejected");
    } catch (error) {
      expect((error as ApiError).status).toBe(404);
      expect((error as ApiError).code).toBe("not_found");
    }
  });
});
