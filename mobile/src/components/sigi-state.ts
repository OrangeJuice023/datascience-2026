import type { SigiState } from '@sigma/contracts';

/**
 * Picks the mascot state for a data status.
 *
 * The mapping is deliberately conservative: a source that is not connected
 * gets the puzzled pose, a failed request gets the concerned pose, and only a
 * result that actually came back gets the "insight" pose. Nothing here ever
 * claims that a condition was detected.
 *
 * It lives in its own module so it can be tested without loading the
 * animation assets.
 */
export function sigiStateForData(input: {
  loading?: boolean;
  failed?: boolean;
  connected?: boolean;
  hasResult?: boolean;
}): SigiState {
  if (input.failed) return 'error';
  if (input.loading) return 'thinking';
  if (input.connected === false) return 'unavailable';
  if (input.hasResult) return 'insight';
  return 'idle';
}
