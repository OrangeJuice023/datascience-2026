import { describe, expect, it } from 'vitest';

import { copilotSigiState, isCopilotUnavailable, sigiStateForData } from './sigi-state';

/**
 * The mascot's state mapping.
 *
 * These rules are what keep a friendly animation from becoming a claim: a
 * failure never looks like a result, and a source that is not connected never
 * looks like a quiet one.
 */

describe('sigiStateForData', () => {
  it('shows the concerned pose when a request failed', () => {
    expect(sigiStateForData({ failed: true, hasResult: true })).toBe('error');
  });

  it('shows the working pose while a request is in flight', () => {
    expect(sigiStateForData({ loading: true })).toBe('thinking');
  });

  it('shows the puzzled pose when a source is not connected', () => {
    expect(sigiStateForData({ connected: false })).toBe('unavailable');
  });

  it('shows the result pose only when a result actually arrived', () => {
    expect(sigiStateForData({ hasResult: true })).toBe('insight');
  });

  it('falls back to waiting when there is nothing to report', () => {
    expect(sigiStateForData({})).toBe('idle');
  });

  it('never reports a result while a request is still running', () => {
    expect(sigiStateForData({ loading: true, hasResult: true })).toBe('thinking');
  });
});

describe('copilotSigiState', () => {
  const base = { sending: false, errorCode: null, draft: '', hasReply: false };

  it('waits, listens, then thinks only while a request is in flight', () => {
    expect(copilotSigiState(base)).toBe('idle');
    expect(copilotSigiState({ ...base, draft: ' hi ' })).toBe('listening');
    expect(copilotSigiState({ ...base, draft: 'hi', sending: true })).toBe('thinking');
  });

  it('shows a result only once a real reply came back', () => {
    expect(copilotSigiState({ ...base, hasReply: true })).toBe('insight');
  });

  it('distinguishes a switched-off copilot from a failure', () => {
    expect(copilotSigiState({ ...base, errorCode: 'not_configured' })).toBe('unavailable');
    expect(copilotSigiState({ ...base, errorCode: 'network_error' })).toBe('error');
    expect(isCopilotUnavailable('not_configured')).toBe(true);
    expect(isCopilotUnavailable(null)).toBe(false);
  });
});
