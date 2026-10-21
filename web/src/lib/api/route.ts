import type { NextRequest } from "next/server";
import type { ApiSuccess, DataStatus } from "@sigma/contracts";
import { ApiError, errorResponse, success, toApiError } from "./envelope";

/**
 * Shared plumbing for the `/api/v1` route handlers.
 *
 * Every handler returns a `RouteResult`; the wrapper turns that into the
 * standard success envelope, and turns anything thrown into the standard
 * error envelope. Handlers therefore never build HTTP responses themselves
 * and never leak an internal exception to a client.
 */

export interface RouteResult<T> {
  data: T;
  /** Status of the data behind the payload. */
  status: DataStatus;
  /** True when the payload holds simulated records. */
  isSample: boolean;
}

export type RouteHandler<T> = (request: NextRequest) => Promise<RouteResult<T>>;

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: extraHeaders });
}

export function withErrors<T>(handler: RouteHandler<T>) {
  return async function route(request: NextRequest): Promise<Response> {
    try {
      const result = await handler(request);
      const body: ApiSuccess<T> = success(result.data, {
        status: result.status,
        isSample: result.isSample,
      });
      return json(body, 200);
    } catch (error) {
      const apiError = toApiError(error);
      const headers: Record<string, string> = {};
      if (apiError.retryAfterSeconds !== undefined) {
        headers["Retry-After"] = String(apiError.retryAfterSeconds);
      }
      return json(
        errorResponse(apiError, { status: "unavailable", isSample: false }),
        apiError.status,
        headers,
      );
    }
  };
}

/** A handler that rejects every method it is registered for. */
export function methodNotAllowed(allowed: string[]) {
  return async function route(request: NextRequest): Promise<Response> {
    const error = ApiError.methodNotAllowed(request.method, allowed);
    return json(
      errorResponse(error, { status: "unavailable", isSample: false }),
      error.status,
      { Allow: allowed.join(", ") },
    );
  };
}
