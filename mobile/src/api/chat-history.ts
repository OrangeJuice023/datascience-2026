import type { ChatMessage } from '@sigma/contracts';

/**
 * The history a copilot request carries.
 *
 * Only complete exchanges go back to the server: a question followed by the
 * reply the server signed for it. A question that failed (and is about to be
 * retried, or was abandoned) is never included, so a retry cannot send the
 * same question twice. Same rule as the web app
 * (web/src/lib/policy-chat/copilot-ui.ts).
 */

/** Matches LIMITS.maxHistory on the server; even, so it keeps whole pairs. */
export const MAX_HISTORY = 10;

export function historyForRequest(turns: ChatMessage[], max = MAX_HISTORY): ChatMessage[] {
  const pairs: ChatMessage[] = [];
  for (let i = 0; i + 1 < turns.length; i++) {
    const question = turns[i];
    const reply = turns[i + 1];
    if (question.role === 'user' && reply.role === 'assistant' && reply.signature) {
      pairs.push(
        { role: 'user', content: question.content },
        { role: 'assistant', content: reply.content, signature: reply.signature }
      );
      i++;
    }
  }
  return pairs.slice(-max);
}

/** The conversation belongs to one server, disease and LGU; changing any of them starts a new one. */
export function conversationKey(baseUrl: string, disease: string | null, locationId: string | null): string {
  return JSON.stringify([baseUrl, disease, locationId]);
}
