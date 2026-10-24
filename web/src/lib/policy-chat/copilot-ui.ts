import type { ChatMessage, SigiState } from "@sigma/contracts";
import type { PolicyEvidenceRecord } from "@/lib/policy-evidence/types";

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Numbered citation links for the evidence the server says the reply cites
 * (any kind: Lab, ACCESS, Policy, Method). The server only returns items the
 * model was actually given, so an invented id stays plain text.
 */
export function linkServerCitations<T extends { id: string }>(reply: string, citations: T[]): { text: string; cited: T[] } {
  if (citations.length === 0) return { text: reply, cited: [] };
  const byId = new Map(citations.map((c) => [c.id, c]));
  const ids = [...byId.keys()].sort((a, b) => b.length - a.length);
  // The prompt asks for [id]; brackets and backticks around an id are consumed with it.
  const pattern = new RegExp(`\\[?\`?(?<![\\w-])(${ids.map(escapeRegExp).join("|")})(?![\\w-])\`?\\]?`, "g");
  const cited: T[] = [];
  const text = reply.replace(pattern, (_match, id: string) => {
    const item = byId.get(id)!;
    let n = cited.indexOf(item) + 1;
    if (n === 0) n = cited.push(item);
    return `[${n}](#cite-${id})`;
  });
  return { text, cited };
}

export interface SuggestionContext {
  /** The place's display name. */
  place: string;
  /** The place has its own reporting-unit series (Lab). */
  hasLab: boolean;
  /** The place has mapped-facility figures (ACCESS). */
  hasAccess: boolean;
  /** SIGMA holds at least one local policy record for the place. */
  hasLocalPolicy: boolean;
}

export interface SuggestionGroup {
  label: string;
  questions: string[];
}

/**
 * Starter questions grouped by what SIGI can actually answer for this place.
 * A group appears only when its evidence exists, and no question implies live
 * data, current case counts, medicine stock or a policy SIGMA does not hold.
 */
export function suggestedQuestionGroups(ctx: SuggestionContext): SuggestionGroup[] {
  const groups: SuggestionGroup[] = [];
  if (ctx.hasLab) {
    groups.push({
      label: "Understand the data",
      questions: [
        `What does the dengue record for ${ctx.place} show from 2016 to 2020?`,
        "Which weeks are missing or questionable, and why does that matter?",
      ],
    });
    groups.push({
      label: "Investigate signals",
      questions: [
        "Did EARS flag a rise before the DOH threshold was crossed in 2019?",
        "What should I verify before reading an EARS alarm as a real increase?",
      ],
    });
  }
  if (ctx.hasAccess) {
    groups.push({
      label: "Explore access",
      questions: [
        `What hospitals and pharmacies are mapped in ${ctx.place}, and what can't that tell us?`,
        "What do dengue IV fluids and paracetamol cost public hospitals?",
      ],
    });
  }
  groups.push({
    label: "Connect evidence",
    questions: [
      ctx.hasLocalPolicy
        ? `What local and national policy evidence applies to ${ctx.place}?`
        : `What national rules apply to ${ctx.place}'s dengue response?`,
      ...(ctx.hasLab ? ["After an unusual rise, what should the LGU check across Lab, ACCESS and Policy?"] : []),
    ],
  });
  return groups;
}
