import type {
  AccessMetricsData,
  ApiSuccess,
  ChatRequestBody,
  ChatResponseData,
  DengueObservationsData,
  DengueSignalsData,
  DengueSummaryData,
  HealthResponse,
  PolicyInfoData,
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

export function fetchSources(baseUrl: string, signal?: AbortSignal): Promise<ApiSuccess<{ sources: PolicyInfoData['sources'] }>> {
  return apiRequest<{ sources: PolicyInfoData['sources'] }>(baseUrl, '/sources', { signal });
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

export function fetchSummary(
  baseUrl: string,
  limit?: number,
  signal?: AbortSignal
): Promise<ApiSuccess<DengueSummaryData>> {
  return apiRequest<DengueSummaryData>(baseUrl, `/dengue/summary${toQuery({ limit })}`, { signal });
}

export function fetchSignals(
  baseUrl: string,
  query: { disease?: string; locationId?: string } = {},
  signal?: AbortSignal
): Promise<ApiSuccess<DengueSignalsData>> {
  return apiRequest<DengueSignalsData>(baseUrl, `/dengue/signals${toQuery({ ...query })}`, { signal });
}

export interface AccessQuery {
  medicineId?: string;
  areaId?: string;
  limit?: number;
}

export function fetchAccessMetrics(
  baseUrl: string,
  query: AccessQuery = {},
  signal?: AbortSignal
): Promise<ApiSuccess<AccessMetricsData>> {
  return apiRequest<AccessMetricsData>(baseUrl, `/access/metrics${toQuery({ ...query })}`, { signal });
}

export function fetchPolicyInfo(baseUrl: string, signal?: AbortSignal): Promise<ApiSuccess<PolicyInfoData>> {
  return apiRequest<PolicyInfoData>(baseUrl, '/policy/info', { signal });
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
