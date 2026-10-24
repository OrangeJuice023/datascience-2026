/**
 * Finds a reachable SIGMA API without anyone typing an address.
 *
 * Candidates, in priority order (the first one whose /health answers wins):
 *  1. `EXPO_PUBLIC_API_BASE_URL`, when the build sets one.
 *  2. The development machine, at the address the app loaded its JavaScript
 *     from (Expo's `hostUri`, e.g. 192.168.1.20:8081), on the web app's port.
 *     This is what makes a phone running Expo Go find a local API.
 *  3. The platform loopback (10.0.2.2 on the Android emulator, localhost
 *     elsewhere).
 *  4. The deployed API.
 *
 * A saved address in Settings skips discovery entirely: it is the user's
 * explicit choice (see state/settings-context.tsx). Every candidate is probed
 * at once with a short timeout, but the result follows the priority order,
 * not whichever answered first.
 */

export const DEPLOYED_BASE_URL = 'https://datascience-2026.vercel.app/api/v1';
export const API_PORT = 3000;
export const PROBE_TIMEOUT_MS = 3_000;

export type CandidateSource = 'environment' | 'dev-machine' | 'loopback' | 'deployed';

export interface Candidate {
  url: string;
  source: CandidateSource;
}

export const SOURCE_LABEL: Record<CandidateSource | 'saved' | 'unreachable', string> = {
  saved: 'Saved in Settings',
  environment: 'Build setting (EXPO_PUBLIC_API_BASE_URL)',
  'dev-machine': 'Found automatically: your development machine',
  loopback: 'Found automatically: this device / emulator host',
  deployed: 'Found automatically: the deployed SIGMA API',
  unreachable: 'No API answered; using the default address',
};

/** `http://<host>:3000/api/v1` from Expo's `hostUri` ("192.168.1.20:8081" or "exp.direct" tunnels). */
export function devMachineBaseUrl(hostUri: string | null | undefined): string | null {
  if (!hostUri) return null;
  const host = hostUri.replace(/^[a-z]+:\/\//i, '').split('/')[0].split(':')[0];
  // A tunnel host (exp.direct, ngrok) forwards Metro only, not the web app's port.
  if (!host || /\.(exp\.direct|ngrok\.io|ngrok-free\.app)$/i.test(host)) return null;
  return `http://${host}:${API_PORT}/api/v1`;
}

export function loopbackBaseUrl(os: string): string {
  return `http://${os === 'android' ? '10.0.2.2' : 'localhost'}:${API_PORT}/api/v1`;
}

export function candidateBaseUrls(input: { env?: string | null; hostUri?: string | null; os: string }): Candidate[] {
  const list: Candidate[] = [];
  const add = (url: string | null | undefined, source: CandidateSource) => {
    const clean = url?.trim().replace(/\/+$/, '');
    if (clean && !list.some((c) => c.url === clean)) list.push({ url: clean, source });
  };
  add(input.env, 'environment');
  add(devMachineBaseUrl(input.hostUri), 'dev-machine');
  add(loopbackBaseUrl(input.os), 'loopback');
  add(DEPLOYED_BASE_URL, 'deployed');
  return list;
}

/** First candidate, in priority order, for which `probe` resolves true. */
export async function discoverBaseUrl(
  candidates: Candidate[],
  probe: (url: string) => Promise<boolean>
): Promise<Candidate | null> {
  const results = candidates.map((c) => probe(c.url).catch(() => false));
  for (let i = 0; i < candidates.length; i++) {
    if (await results[i]) return candidates[i];
  }
  return null;
}
