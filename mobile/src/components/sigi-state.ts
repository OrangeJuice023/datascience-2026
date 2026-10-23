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

/** API error codes that mean "the copilot is switched off", not "it failed". */
const UNAVAILABLE_CODES = new Set(['not_configured']);

/** Whether an API error code means the copilot is unavailable rather than broken. */
export function isCopilotUnavailable(code: string | null): boolean {
  return code !== null && UNAVAILABLE_CODES.has(code);
}

/**
 * Sigi in the Policy Copilot, following the request and never the data:
 * listening while a question is typed, thinking while a request is in flight,
 * "insight" only once a real reply came back, "unavailable" when no model is
 * configured, and "error" for any other failure. Same rules as the web app
 * (web/src/lib/policy-chat/copilot-ui.ts).
 */
export function copilotSigiState(input: {
  sending: boolean;
  errorCode: string | null;
  draft: string;
  hasReply: boolean;
}): SigiState {
  if (input.sending) return 'thinking';
  if (input.errorCode) return isCopilotUnavailable(input.errorCode) ? 'unavailable' : 'error';
  if (input.draft.trim().length > 0) return 'listening';
  if (input.hasReply) return 'insight';
  return 'idle';
}
