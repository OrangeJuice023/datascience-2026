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

/** Matches LIMITS.maxReplyLength on the server: a longer turn would be refused. */
export const MAX_TURN_LENGTH = 8000;

/**
 * Bytes the history may take in the request body. The server refuses bodies
 * over 16 KB; this leaves room for the new question and the other fields.
 * The newest exchanges that fit are kept, so a long conversation never grows
 * into a body the server refuses on every retry.
 */
export const HISTORY_BYTE_BUDGET = 10 * 1024;

export function historyForRequest(
  turns: ChatMessage[],
  max = MAX_HISTORY,
  budget = HISTORY_BYTE_BUDGET
): ChatMessage[] {
  const pairs: [ChatMessage, ChatMessage][] = [];
  for (let i = 0; i + 1 < turns.length; i++) {
    const question = turns[i];
    const reply = turns[i + 1];
    if (question.role === 'user' && reply.role === 'assistant' && reply.signature) {
      if (question.content.length <= MAX_TURN_LENGTH && reply.content.length <= MAX_TURN_LENGTH) {
        pairs.push([
          { role: 'user', content: question.content },
          { role: 'assistant', content: reply.content, signature: reply.signature },
        ]);
      }
      i++;
    }
  }
  const kept: ChatMessage[] = [];
  let bytes = 2; // the surrounding [ ]
  for (let p = pairs.length - 1; p >= 0 && kept.length + 2 <= max; p--) {
    const size = new TextEncoder().encode(JSON.stringify(pairs[p])).length + 1;
    if (bytes + size > budget) break;
    bytes += size;
    kept.unshift(...pairs[p]);
  }
  return kept;
}

/** The conversation belongs to one server, disease and LGU; changing any of them starts a new one. */
export function conversationKey(baseUrl: string, disease: string | null, locationId: string | null): string {
  return JSON.stringify([baseUrl, disease, locationId]);
}
