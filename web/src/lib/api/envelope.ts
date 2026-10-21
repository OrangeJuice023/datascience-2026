import type { ApiErrorCode, ApiErrorResponse, ApiMeta, ApiSuccess, DataStatus } from "@sigma/contracts";

/**
 * API envelope helpers.
 *
 * Rules:
 * - Every response is `{ data, meta }` or `{ error, meta }`; never a bare value.
 * - `meta.status` says whether the payload is live, demo, unavailable or not
 *   connected. Consumers can branch on it without inspecting the payload.
 * - Error messages are written for a client to display. Internal exception
 *   text, stack traces, file paths and environment values never appear here.
 */

export const API_VERSION = "v1" as const;
export const SERVICE_NAME = "sigma-api" as const;

export interface MetaInput {
  status: DataStatus;
  isSample: boolean;
  /** Fixed clock, injectable so responses are deterministic under test. */
  now?: Date;
}

export function buildMeta(input: MetaInput): ApiMeta {
  return {
    apiVersion: API_VERSION,
    generatedAt: (input.now ?? new Date()).toISOString(),
    status: input.status,
    isSample: input.isSample,
  };
}

export function success<T>(data: T, input: MetaInput): ApiSuccess<T> {
  return { data, meta: buildMeta(input) };
}

/**
 * A client-safe error. `details` carries field-level problems only
 * (e.g. which query parameters were invalid).
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    options: { details?: Record<string, string[]>; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = options.details;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  static badRequest(message: string, details?: Record<string, string[]>): ApiError {
    return new ApiError("bad_request", 400, message, { details });
  }

  static notFound(message: string): ApiError {
    return new ApiError("not_found", 404, message);
  }

  static methodNotAllowed(method: string, allowed: string[]): ApiError {
    return new ApiError("method_not_allowed", 405, `${method} is not supported by this endpoint.`, {
      details: { allow: allowed },
    });
  }

  static payloadTooLarge(message: string): ApiError {
    return new ApiError("payload_too_large", 413, message);
  }

  static rateLimited(message: string, retryAfterSeconds: number): ApiError {
    return new ApiError("rate_limited", 429, message, { retryAfterSeconds });
  }

  static notConfigured(message: string): ApiError {
    return new ApiError("not_configured", 503, message);
  }

  static upstreamUnavailable(message: string): ApiError {
    return new ApiError("upstream_unavailable", 502, message);
  }

  static internal(message = "The request could not be completed."): ApiError {
    return new ApiError("internal_error", 500, message);
  }
}

export function errorResponse(
  error: ApiError,
  input: { status: DataStatus; isSample: boolean; now?: Date },
): ApiErrorResponse {
  const body: ApiErrorResponse["error"] = {
    code: error.code,
    message: error.message,
  };
  if (error.details) body.details = error.details;
  if (error.retryAfterSeconds !== undefined) body.retryAfterSeconds = error.retryAfterSeconds;

  return {
    error: body,
    meta: buildMeta({ ...input, status: input.status }),
  };
}

/**
 * Normalises anything thrown inside a handler into a client-safe error.
 * The original error is never forwarded; it is only used to decide the code.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return ApiError.internal();
}
