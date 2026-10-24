"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ExternalLink, RotateCcw, Send } from "lucide-react";
import type { ChatCitation, ChatResponseData } from "@sigma/contracts";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Sigi } from "@/components/mascot/sigi";
import { CopilotAnswer } from "@/components/policy/copilot-answer";
import {
  copilotSigiState,
  historyForRequest,
  isCopilotUnavailable,
  linkServerCitations,
  suggestedQuestionGroups,
  type SuggestionContext,
} from "@/lib/policy-chat/copilot-ui";
import { cn } from "@/lib/utils";

interface Turn {
  role: "user" | "assistant";
  content: string;
  /** The server's signature for an assistant reply; sent back with the history. */
  signature?: string;
  /** What the API said about an assistant reply: model, scope, limitations. */
  meta?: Pick<ChatResponseData, "model" | "contextScope" | "limitations">;
  /** The reply with its cited ids turned into numbered links. */
  display?: string;
  /** The server-verified citations, in citation-number order. */
  citations?: ChatCitation[];
  /** Ids the reply named that SIGI was not given; never shown as sources. */
  rejected?: string[];
}

interface CopilotError {
  code: string | null;
  message: string;
  /** The question to resend on retry. */
  question: string;
}

interface PolicyCopilotProps {
  disease: string;
  /** A reporting-unit id (or one of the app's LGU ids). */
  locationId: string;
  locationName?: string;
  /** An optional second unit to compare with; part of the conversation's scope. */
  compareLocationId?: string;
  compareName?: string;
  /** What evidence exists for the place, so suggestions never promise more. */
  suggestionContext: SuggestionContext;
  /**
   * "hero": the compact frame at the top of Analyze (one line of intro, the
   * place pickers, chips for suggestions); "panel": the bordered card.
   */
  variant?: "panel" | "hero";
  /** Hero only: the line under "Ask SIGI". */
  intro?: ReactNode;
  /** Hero only: the place pickers, shown under the intro. */
  controls?: ReactNode;
}

/**
 * SIGI in Analyze: a conversation over the evidence SIGMA holds for the
 * selected reporting unit across Lab, ACCESS and Policy. The request goes to
 * POST /api/v1/chat, where the evidence pack and system prompt are built;
 * the provider key never reaches the browser. Every reply shows the sources
 * the server verified it cites, and flags any id it was not given.
 *
 * One instance holds one conversation: PolicyView keys it by place (and any
 * comparison place), so switching starts a new conversation and a reply still
 * in flight for the old place is discarded with it.
 */
export function PolicyCopilot({
  disease,
  locationId,
  locationName,
  compareLocationId,
  compareName,
  suggestionContext,
  variant = "panel",
  intro,
  controls,
}: PolicyCopilotProps) {
  const hero = variant === "hero";
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<CopilotError | null>(null);
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const place = locationName ?? locationId;
  const suggestionGroups = useMemo(() => suggestedQuestionGroups(suggestionContext), [suggestionContext]);
  const unavailable = isCopilotUnavailable(error?.code ?? null);
  const hasReply = turns.some((t) => t.role === "assistant");
  const sigiState = copilotSigiState({ sending, errorCode: error?.code ?? null, draft, hasReply });

  const statusLine = sending
    ? "SIGI is reading the evidence…"
    : unavailable
      ? "SIGI is not configured on this deployment. The evidence panel still works."
      : error
        ? "The last request failed. Nothing was generated in its place."
        : hasReply
          ? "Answer received. Check it against the evidence before using it."
          : `Ask about ${place}${compareName ? ` and ${compareName}` : ""}: what the data shows, what is missing, and what to check next.`;

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    // Signed, answered exchanges only: an earlier failed question is left out.
    const history = historyForRequest(turns);
    setTurns((current) => [...current, { role: "user", content: question }]);
    setDraft("");
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history, disease, locationId, ...(compareLocationId ? { compareLocationId } : {}) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError({
          code: body?.error?.code ?? null,
          message: body?.error?.message ?? "SIGI's request failed.",
          question,
        });
        return;
      }
      const data = body?.data as ChatResponseData | undefined;
      if (!data?.reply) {
        setError({ code: null, message: "SIGI returned an empty answer. Nothing was generated in its place.", question });
        return;
      }
      setTurns((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply,
          signature: data.replySignature,
          meta: { model: data.model, contextScope: data.contextScope, limitations: data.limitations },
          // Only ids the server says the model was given become links.
          ...(() => {
            const { text, cited } = linkServerCitations(data.reply, data.citations ?? []);
            return { display: text, citations: cited, rejected: data.rejectedCitationIds ?? [] };
          })(),
        },
      ]);
    } catch {
      setError({ code: null, message: "SIGI could not be reached. Check your connection.", question });
    } finally {
      setSending(false);
    }
  }

  function retry() {
    if (!error) return;
    const question = error.question;
    // Drop the unanswered question from the log; send() re-adds it once.
    // historyForRequest never includes it, so it is not sent twice.
    setTurns((current) => (current.at(-1)?.role === "user" ? current.slice(0, -1) : current));
    void send(question);
  }

  function reset() {
    setTurns([]);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <section aria-labelledby={`${inputId}-title`} className="flex flex-col rounded-[var(--radius-card)] border border-border bg-sheet">
      {hero ? (
        <header className="flex flex-col gap-3 border-b border-rule p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <Sigi state={sigiState} size={56} className="shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={`${inputId}-title`} className="text-lg font-semibold tracking-[-0.01em] text-ink">
                  Ask SIGI
                </h2>
                <StatusBadge label="AI-generated · verify before use" tone="warning" />
                <StatusBadge label="Free LLM · some chats are rate limited" />
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{intro}</p>
            </div>
          </div>
          {controls}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" aria-live="polite" className="text-xs text-slate-500">
              {statusLine}
            </p>
            {(turns.length > 0 || error) && (
              <Button variant="secondary" onClick={reset} className="shrink-0">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                New conversation
              </Button>
            )}
          </div>
        </header>
      ) : (
      <header className="flex flex-wrap items-start gap-4 border-b border-rule p-4 sm:flex-nowrap sm:p-5">
        <Sigi state={sigiState} size={72} className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${inputId}-title`} className="text-base font-semibold text-ink">
              Ask SIGI
            </h2>
            <StatusBadge label="AI-generated · verify before use" tone="warning" />
            <StatusBadge label="Free LLM · some chats are rate limited" />
          </div>
          <p className="text-sm text-slate-600">
            Answers about <span className="font-medium text-ink">{place}</span>
            {compareName ? (
              <>
                {" "}and <span className="font-medium text-ink">{compareName}</span>
              </>
            ) : null}{" "}
            ({disease}) from SIGMA&apos;s Lab, ACCESS and Policy evidence, and cites every source. It does not declare
            outbreaks, know current case counts or medicine stock, or make decisions for you.
          </p>
          <p role="status" aria-live="polite" className="text-xs text-slate-500">
            {statusLine}
          </p>
        </div>
        {(turns.length > 0 || error) && (
          <Button variant="ghost" onClick={reset} className="shrink-0">
            New conversation
          </Button>
        )}
      </header>
      )}

      <div className={cn("flex flex-col p-4 sm:p-5", hero ? "gap-3" : "gap-4")}>
        {turns.length > 0 && (
          <ol
            role="log"
            aria-label="Conversation"
            className={cn("flex flex-col gap-3 overflow-y-auto", hero ? "max-h-[55vh]" : "max-h-[32rem]")}
          >
            {turns.map((turn, i) => (
              <li key={i} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                {turn.role === "user" ? (
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-card)] bg-ink px-3 py-2 text-sm text-white">
                    {turn.content}
                  </p>
                ) : (
                  <div className="w-full max-w-[95%] rounded-[var(--radius-card)] border border-border bg-raised px-4 py-3">
                    <CopilotAnswer text={turn.display ?? turn.content} anchorPrefix={`answer-${i}`} />
                    <AnswerProvenance turn={turn} anchorPrefix={`answer-${i}`} />
                  </div>
                )}
              </li>
            ))}
            {sending && (
              <li className="text-sm text-slate-500" aria-hidden="true">
                SIGI is reading the evidence…
              </li>
            )}
          </ol>
        )}

        {error && (
          <div
            className={cn(
              "flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-sm",
              unavailable ? "border-border bg-raised text-slate-700" : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            <p className="min-w-0 flex-1">{error.message}</p>
            <Button variant="ghost" onClick={retry}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {unavailable ? "Check again" : "Try again"}
            </Button>
          </div>
        )}

        {turns.length === 0 && !unavailable && hero && (
          <ul aria-label="Suggested questions" className="flex flex-wrap gap-2">
            {suggestionGroups.map((group) => (
              <li key={group.label} className="max-w-full">
                <button
                  type="button"
                  onClick={() => send(group.questions[0])}
                  disabled={sending}
                  title={group.label}
                  className="min-h-11 max-w-full rounded-full border border-border bg-sheet px-3.5 py-1.5 text-left text-[13px] text-slate-700 transition-colors hover:border-accent hover:bg-accent-soft hover:text-ink disabled:opacity-50 sm:min-h-9"
                >
                  {group.questions[0]}
                </button>
              </li>
            ))}
          </ul>
        )}

        {turns.length === 0 && !unavailable && !hero && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {suggestionGroups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-slate-600">{group.label}</p>
                <ul className="flex flex-col gap-1.5">
                  {group.questions.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => send(q)}
                        disabled={sending}
                        className="min-h-11 w-full rounded-[var(--radius-control)] border border-border px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-accent hover:bg-accent-soft hover:text-ink disabled:opacity-50"
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor={inputId} className="sr-only">
            Question for the Policy Copilot
          </label>
          <textarea
            ref={inputRef}
            id={inputId}
            name="question"
            autoComplete="off"
            rows={hero ? 2 : 3}
            value={draft}
            disabled={unavailable}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            placeholder={`Ask about ${place}, e.g. what should be verified first…`}
            className="w-full resize-y rounded-[var(--radius-control)] border border-control bg-sheet px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:bg-raised disabled:text-slate-500"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Enter to send · Shift+Enter for a new line</p>
            <Button type="submit" disabled={sending || unavailable || !draft.trim()} aria-busy={sending}>
              <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

const KIND_LABEL: Record<ChatCitation["kind"], string> = {
  lab: "Lab",
  access: "ACCESS",
  policy: "Policy",
  method: "Method",
};

/** The numbered sources behind an answer (server-verified), then what it was based on. */
function AnswerProvenance({ turn, anchorPrefix }: { turn: Turn; anchorPrefix: string }) {
  if (!turn.meta) return null;
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3 text-xs text-slate-500">
      {turn.citations && turn.citations.length > 0 ? (
        <div>
          <p className="font-semibold text-slate-600">Sources</p>
          <ol className="mt-1.5 flex flex-col gap-2">
            {turn.citations.map((c, n) => (
              <li key={c.id} id={`${anchorPrefix}-${c.id}`} className="flex scroll-mt-24 gap-2">
                <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded bg-accent-soft px-1 text-xs font-semibold text-accent ring-1 ring-teal-200">
                  {n + 1}
                </span>
                <span className="min-w-0 text-slate-600">
                  <span className="font-medium text-ink">{c.title}</span>
                  <span className="ml-1.5 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                    {KIND_LABEL[c.kind]} · {c.jurisdiction}
                  </span>
                  <span className="block">
                    {c.source.name}
                    {c.source.url && /^https?:\/\//i.test(c.source.url) && (
                      <a href={c.source.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-accent hover:underline">
                        source
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                    {c.href && (
                      <a href={c.href} className="ml-2 text-accent hover:underline">
                        open in SIGMA
                      </a>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p>This answer cites none of the evidence SIGI was given, so treat it as unsupported.</p>
      )}
      {turn.rejected && turn.rejected.length > 0 && (
        <p className="rounded-[var(--radius-control)] bg-amber-50 px-2.5 py-1.5 text-amber-900">
          SIGI referred to evidence it was not given for this place ({turn.rejected.join(", ")}). Those parts are
          unsupported and are not shown as sources.
        </p>
      )}
      <p>
        <span className="font-medium text-slate-600">Based on:</span> {turn.meta.contextScope}
      </p>
      <details>
        <summary className="cursor-pointer py-3 text-slate-600 hover:text-ink sm:py-0">
          Limitations · model {turn.meta.model}
        </summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {turn.meta.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
