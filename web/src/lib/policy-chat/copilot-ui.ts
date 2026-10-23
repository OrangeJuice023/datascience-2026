import type { ChatMessage, SigiState } from "@sigma/contracts";
import type { PolicyEvidenceRecord, PolicyEvidenceTopic } from "@/lib/policy-evidence/types";

/**
 * Client-side rules for the Policy Copilot panel. Pure, so they are tested
 * (copilot-ui.test.ts) rather than left to the component.
 */

/** API error codes that mean "the copilot is switched off", not "it failed". */
const UNAVAILABLE_CODES = new Set(["not_configured"]);

/**
 * Sigi follows what the copilot request is doing, never what the data means:
 * listening while a question is typed, thinking while a request is in
 * flight, "insight" only once a real reply came back, "unavailable" when no
 * model is configured, and "error" for any other failure.
 */
export function copilotSigiState(input: {
  sending: boolean;
  errorCode: string | null;
  draft: string;
  hasReply: boolean;
}): SigiState {
  if (input.sending) return "thinking";
  if (input.errorCode) return UNAVAILABLE_CODES.has(input.errorCode) ? "unavailable" : "error";
  if (input.draft.trim().length > 0) return "listening";
  if (input.hasReply) return "insight";
  return "idle";
}

/** Whether an API error code means the copilot is unavailable rather than broken. */
export function isCopilotUnavailable(code: string | null): boolean {
  return code !== null && UNAVAILABLE_CODES.has(code);
}

/** Matches LIMITS.maxHistory on the server; even, so it keeps whole pairs. */
export const MAX_HISTORY = 10;

/** Matches LIMITS.maxReplyLength on the server: a longer turn would be refused. */
export const MAX_TURN_LENGTH = 8000;

/**
 * Bytes the history may take in the request body. The server refuses bodies
 * over 16 KB (LIMITS.maxBodyBytes); this leaves room for the new question
 * (up to 2,000 characters, escaped) and the other fields.
 */
export const HISTORY_BYTE_BUDGET = 10 * 1024;

/**
 * The history a request carries: complete exchanges only, each a question
 * followed by the reply the server signed for it. A failed question (about to
 * be retried, or abandoned) is never included, so a retry cannot send the
 * same question twice, and the server rejects unsigned replies anyway.
 *
 * The newest exchanges that fit `budget` bytes are kept and older ones are
 * dropped, so a long conversation never grows into a body the server refuses
 * (which would otherwise fail every retry the same way).
 */
export function historyForRequest(
  turns: ChatMessage[],
  max = MAX_HISTORY,
  budget = HISTORY_BYTE_BUDGET,
): ChatMessage[] {
  const pairs: [ChatMessage, ChatMessage][] = [];
  for (let i = 0; i + 1 < turns.length; i++) {
    const question = turns[i];
    const reply = turns[i + 1];
    if (question.role === "user" && reply.role === "assistant" && reply.signature) {
      if (question.content.length <= MAX_TURN_LENGTH && reply.content.length <= MAX_TURN_LENGTH) {
        pairs.push([
          { role: "user", content: question.content },
          { role: "assistant", content: reply.content, signature: reply.signature },
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

/** The key that gives each disease and LGU its own conversation (see PolicyView). */
export function copilotConversationKey(disease: string, locationId: string): string {
  return JSON.stringify([disease, locationId]);
}

/**
 * The curated records a reply refers to, found by their ids in the reply
 * text. Only records the copilot was actually given can match, so the panel
 * never shows a citation the model could not have seen.
 */
export function referencedEvidence(reply: string, records: PolicyEvidenceRecord[]): PolicyEvidenceRecord[] {
  return records.filter(
    (r) => reply.includes(r.evidenceId) || r.sourceIds.some((id) => id && reply.includes(id)),
  );
}

const BASE_QUESTIONS = [
  "What should the LGU verify before acting on this signal?",
  "What evidence is missing or unreliable?",
  "Could this signal be explained by incomplete reporting or a backlog?",
];

const TOPIC_QUESTIONS: Partial<Record<PolicyEvidenceTopic, string>> = {
  budget_procurement_fiscal: "What does the budget and procurement evidence show, and what does it not show?",
  reported_outcomes: "Can the reported outcomes be attributed to the LGU's response?",
  policy_adoption_mandate: "Which ordinances or mandates are documented, and what remains unverified?",
  implementation_organizational: "What implementation is documented, and how was it verified?",
  surveillance_reporting: "What does the evidence say about surveillance and reporting?",
};

/**
 * Suggested questions for the selected context: three general questions,
 * plus one for each evidence topic the copilot actually has records for.
 * With no signal for the combination, "this signal" becomes "this context".
 */
export function suggestedQuestions(records: PolicyEvidenceRecord[], hasSignal: boolean): string[] {
  const topics = new Set(records.map((r) => r.topic));
  const topical = Object.entries(TOPIC_QUESTIONS)
    .filter(([topic]) => topics.has(topic as PolicyEvidenceTopic))
    .map(([, question]) => question as string);
  const all = [...BASE_QUESTIONS, ...topical];
  return hasSignal ? all : all.map((q) => q.replace("this signal", "this context"));
}
