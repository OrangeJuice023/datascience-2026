import type {
  AccessMedicinesData,
  AccessUnitsData,
  ApiSuccess,
  ChatRequestBody,
  ChatResponseData,
  DengueObservationsData,
  DengueSignalsData,
  DengueSummaryData,
  DengueUnitsData,
  HealthResponse,
} from '@sigma/contracts';

import { apiRequest, toQuery } from './client';

/**
 * Typed wrappers for the SIGMA API.
 *
 * Each one returns the full envelope so the caller keeps access to
 * `meta.status` — the difference between a live series and a demo series
 * has to survive all the way to the screen.
 */

export interface ApiIndexData {
  service: string;
  apiVersion: string;
  endpoints: { method: string; path: string; description: string }[];
}

export function fetchApiIndex(baseUrl: string, signal?: AbortSignal): Promise<ApiSuccess<ApiIndexData>> {
  return apiRequest<ApiIndexData>(baseUrl, '', { signal });
}

export function fetchHealth(baseUrl: string, signal?: AbortSignal): Promise<ApiSuccess<HealthResponse>> {
  return apiRequest<HealthResponse>(baseUrl, '/health', { signal });
}

export interface ObservationsQuery {
  from?: string;
  to?: string;
  limit?: number;
}

export function fetchObservations(
  baseUrl: string,
  query: ObservationsQuery = {},
  signal?: AbortSignal
): Promise<ApiSuccess<DengueObservationsData>> {
  return apiRequest<DengueObservationsData>(baseUrl, `/dengue/observations${toQuery({ ...query })}`, { signal });
}

/** The national OpenDengue series, aggregated. `limit` caps the weekly points, not the coverage figures. */
export function fetchSummary(
  baseUrl: string,
  limit?: number,
  signal?: AbortSignal
): Promise<ApiSuccess<DengueSummaryData>> {
  return apiRequest<DengueSummaryData>(baseUrl, `/dengue/summary${toQuery({ limit })}`, { signal });
}

/**
 * EARS C1/C2/C3 results from /dengue/signals: the latest week for every unit
 * by default, one unit's whole series with `locationId`, or one week with `week`.
 */
export function fetchSignals(
  baseUrl: string,
  query: { locationId?: string; week?: string } = {},
  signal?: AbortSignal
): Promise<ApiSuccess<DengueSignalsData>> {
  return apiRequest<DengueSignalsData>(baseUrl, `/dengue/signals${toQuery({ ...query })}`, { signal });
}

/** The 126 HDX reporting units with their per-epi-year EARS and DOH-threshold counts, or one unit. */
export function fetchDengueUnits(
  baseUrl: string,
  query: { unitId?: string } = {},
  signal?: AbortSignal
): Promise<ApiSuccess<DengueUnitsData>> {
  return apiRequest<DengueUnitsData>(baseUrl, `/dengue/units${toQuery({ ...query })}`, { signal });
}

/** Facilities mapped in OpenStreetMap for a reporting unit. Stock, search demand and population are always null. */
export function fetchAccessUnits(
  baseUrl: string,
  query: { unitId?: string } = {},
  signal?: AbortSignal
): Promise<ApiSuccess<AccessUnitsData>> {
  return apiRequest<AccessUnitsData>(baseUrl, `/access/units${toQuery({ ...query })}`, { signal });
}

/** Dengue medicines and what DOH hospitals paid for them: procurement prices, not shelf prices or stock. */
export function fetchAccessMedicines(baseUrl: string, signal?: AbortSignal): Promise<ApiSuccess<AccessMedicinesData>> {
  return apiRequest<AccessMedicinesData>(baseUrl, '/access/medicines', { signal });
}

export function sendChat(
  baseUrl: string,
  body: ChatRequestBody,
  signal?: AbortSignal
): Promise<ApiSuccess<ChatResponseData>> {
  return apiRequest<ChatResponseData>(baseUrl, '/chat', {
    method: 'POST',
    body,
    signal,
    timeoutMs: 45_000,
  });
}
