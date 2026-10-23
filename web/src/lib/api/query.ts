import { ApiError } from "./envelope";

/**
 * Query-parameter validation.
 *
 * Deliberately strict: an unknown or malformed parameter is a client error,
 * not something silently ignored. Limits exist so a single request cannot
 * pull an unbounded payload.
 */

export const LIMITS = {
  /** Maximum observation records returned by one request. */
  maxObservations: 2000,
  /** Maximum weekly summary points returned by one request. */
  maxSummaryPoints: 1200,
  /** Maximum ACCESS metric rows returned by one request. */
  maxAccessMetrics: 1000,
  /** Maximum request body size for JSON endpoints, in bytes. */
  maxBodyBytes: 16 * 1024,
  /** Maximum characters in a chat message. */
  maxMessageLength: 2000,
  /** Maximum chat history messages carried into a request. Even, so it keeps whole question/answer pairs. */
  maxHistory: 10,
  /** Maximum characters in one history turn (an earlier reply can be longer than a question). */
  maxReplyLength: 8000,
  /** Maximum completion tokens requested from a model provider. */
  maxCompletionTokens: 1500,
  /** Upstream request timeout, milliseconds. */
  requestTimeoutMs: 30_000,
} as const;

export type QueryValue = string | string[] | null | undefined;

function single(value: QueryValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export interface ParsedQuery {
  params: URLSearchParams;
  /** All values for a key, in order. */
  all(key: string): string[];
  /** First value for a key, or undefined. */
  get(key: string): string | undefined;
  has(key: string): boolean;
}

export function parseQuery(url: URL): ParsedQuery {
  const params = url.searchParams;
  return {
    params,
    all: (key) => params.getAll(key),
    get: (key) => single(params.get(key)),
    has: (key) => params.has(key),
  };
}

/** Rejects any parameter that is not in the allow-list, so typos surface. */
export function assertKnownParams(query: ParsedQuery, allowed: readonly string[]): void {
  const unknown = [...query.params.keys()].filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return;
  throw ApiError.badRequest(
    `Unsupported query parameter${unknown.length > 1 ? "s" : ""}: ${[...new Set(unknown)].sort().join(", ")}.`,
    { unknown: [...new Set(unknown)].sort() },
  );
}

export interface IntRangeOptions {
  min: number;
  max: number;
  fallback: number;
}

export function parseIntOption(
  query: ParsedQuery,
  key: string,
  { min, max, fallback }: IntRangeOptions,
): number {
  const raw = query.get(key);
  if (raw === undefined || raw === "") return fallback;
  if (!/^-?\d+$/.test(raw)) {
    throw ApiError.badRequest(`"${key}" must be a whole number.`, { [key]: ["not an integer"] });
  }
  const value = Number.parseInt(raw, 10);
  if (value < min || value > max) {
    throw ApiError.badRequest(`"${key}" must be between ${min} and ${max}.`, {
      [key]: [`out of range (${min}–${max})`],
    });
  }
  return value;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOption(
  query: ParsedQuery,
  key: string,
): { value: string; date: Date } | undefined {
  const raw = query.get(key);
  if (raw === undefined || raw === "") return undefined;
  if (!ISO_DATE.test(raw)) {
    throw ApiError.badRequest(`"${key}" must be an ISO date (YYYY-MM-DD).`, {
      [key]: ["not an ISO date"],
    });
  }
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    // `new Date` silently rolls an impossible date over (2020-02-31 becomes
    // 2020-03-02), so the round trip is what actually proves the date exists.
    throw ApiError.badRequest(`"${key}" is not a valid calendar date.`, {
      [key]: ["not a valid date"],
    });
  }
  return { value: raw, date };
}

/** Returns the allowed values when the parameter is present but not allowed. */
export function parseEnumOption<T extends string>(
  query: ParsedQuery,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const raw = query.get(key);
  if (raw === undefined || raw === "") return undefined;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw ApiError.badRequest(`"${key}" must be one of: ${allowed.join(", ")}.`, {
      [key]: [`expected one of ${allowed.join(", ")}`],
    });
  }
  return raw as T;
}

/** Validates a repeating or single value against a known set. */
export function parseIdOption(
  query: ParsedQuery,
  key: string,
  allowed: readonly string[],
): string | undefined {
  const raw = query.get(key);
  if (raw === undefined || raw === "") return undefined;
  if (!allowed.includes(raw)) {
    throw ApiError.notFound(`No ${key.replace(/s$/, "")} named "${raw}".`);
  }
  return raw;
}
