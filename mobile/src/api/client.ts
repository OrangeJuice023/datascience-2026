import type {
  ApiErrorBody,
  ApiErrorResponse,
  ApiSuccess,
} from '@sigma/contracts';

/**
 * The API client.
 *
 * Every endpoint answers with `{ data, meta }` or `{ error, meta }`. This
 * client keeps that shape intact and turns anything that goes wrong into a
 * single `ApiError` type, so a screen never has to reason about three
 * different failure shapes.
 *
 * Two rules the client enforces:
 * - A non-2xx response is an error even if the body parses. A partially
 *   successful response is still not a success.
 * - `meta.status` is carried through untouched. `not_connected` and
 *   `unavailable` are different states from `live`, and the UI shows them
 *   differently.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, string[]>;
  readonly retryAfterSeconds?: number;

  constructor(
    code: string,
    status: number,
    message: string,
    options: { details?: Record<string, string[]>; retryAfterSeconds?: number } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = options.details;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  /** True when the request never reached the server. */
  get isNetworkError(): boolean {
    return this.code === 'network_error';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;

function isErrorBody(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  if (!body.error || typeof body.error !== 'object') return false;
  const error = body.error as Record<string, unknown>;
  return typeof error.code === 'string' && typeof error.message === 'string';
}

function toApiError(value: ApiErrorBody | undefined, status: number): ApiError {
  return new ApiError(value?.code ?? 'internal_error', status, value?.message ?? 'The request failed.', {
    details: value?.details,
    retryAfterSeconds: value?.retryAfterSeconds,
  });
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {}
): Promise<ApiSuccess<T>> {
  const { method = 'GET', body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new ApiError(
      aborted ? 'timeout' : 'network_error',
      0,
      aborted
        ? 'The request timed out. Check the API address in Settings.'
        : 'Could not reach the API. Check the API address in Settings and that the server is running.'
    );
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  let parsed: unknown = null;
  let unreadable = false;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      unreadable = true;
    }
  }

  if (!response.ok) {
    if (isErrorBody(parsed)) {
      throw toApiError((parsed as ApiErrorResponse).error, response.status);
    }
    // The status code is the fact worth reporting. The body may be a proxy's
    // HTML error page, and none of it is worth showing to a user.
    throw new ApiError('http_error', response.status, `The API responded with status ${response.status}.`);
  }

  if (unreadable) {
    throw new ApiError('malformed_response', response.status, 'The API returned a response that could not be read.');
  }

  if (!parsed || typeof parsed !== 'object' || !('data' in parsed) || !('meta' in parsed)) {
    throw new ApiError('malformed_response', response.status, 'The API returned an unexpected response shape.');
  }

  return parsed as ApiSuccess<T>;
}

/** Builds a query string from defined values only. */
export function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
