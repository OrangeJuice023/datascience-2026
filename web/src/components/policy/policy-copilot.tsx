"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Send, RotateCcw } from "lucide-react";
import type { ChatResponseData } from "@sigma/contracts";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Sigi } from "@/components/mascot/sigi";
import type { PolicyEvidenceRecord } from "@/lib/policy-evidence/types";
import {
  copilotSigiState,
  isCopilotUnavailable,
  referencedEvidence,
  suggestedQuestions,
} from "@/lib/policy-chat/copilot-ui";
import { cn } from "@/lib/utils";

interface Turn {
  role: "user" | "assistant";
  content: string;
  /** What the API said about an assistant reply: model, scope, limitations. */
  meta?: Pick<ChatResponseData, "model" | "contextScope" | "limitations">;
  cited?: PolicyEvidenceRecord[];
}

interface CopilotError {
  code: string | null;
  message: string;
  /** The question to resend on retry. */
  question: string;
}

interface PolicyCopilotProps {
  disease: string;
  locationId: string;
  locationName?: string;
  hasSignal: boolean;
  /** The curated records the server gives the model for this LGU. */
  evidence: PolicyEvidenceRecord[];
}

/**
 * The Policy Copilot: a conversation over the evidence SIGMA holds for the
 * selected LGU. The request goes to POST /api/v1/chat; the provider key and
 * the system prompt stay on the server. Every reply is shown with what the
 * API says it was based on, and with any curated records it refers to.
 */
export function PolicyCopilot({ disease, locationId, locationName, hasSignal, evidence }: PolicyCopilotProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<CopilotError | null>(null);
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const place = locationName ?? locationId;
  const suggestions = useMemo(() => suggestedQuestions(evidence, hasSignal), [evidence, hasSignal]);
  const unavailable = isCopilotUnavailable(error?.code ?? null);
  const hasReply = turns.some((t) => t.role === "assistant");
  const sigiState = copilotSigiState({ sending, errorCode: error?.code ?? null, draft, hasReply });

  const statusLine = sending
    ? "Asking the copilot…"
    : unavailable
      ? "The copilot is not configured on this deployment. The evidence panel still works."
      : error
        ? "The last request failed. Nothing was generated in its place."
        : hasReply
          ? "Answer received. Check it against the evidence before using it."
          : `Ask about ${place}: what to verify, what is missing, what the evidence does and does not show.`;

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((current) => [...current, { role: "user", content: question }]);
    setDraft("");
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history, disease, locationId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError({
          code: body?.error?.code ?? null,
          message: body?.error?.message ?? "The copilot request failed.",
          question,
        });
        return;
      }
      const data = body?.data as ChatResponseData | undefined;
      if (!data?.reply) {
        setError({ code: null, message: "The copilot returned an empty response.", question });
        return;
      }
      setTurns((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply,
          meta: { model: data.model, contextScope: data.contextScope, limitations: data.limitations },
          cited: referencedEvidence(data.reply, evidence),
        },
      ]);
    } catch {
      setError({ code: null, message: "The copilot could not be reached. Check your connection.", question });
    } finally {
      setSending(false);
    }
  }

  function retry() {
    if (!error) return;
    const question = error.question;
    // Drop the unanswered question so it is not sent twice in the history.
    setTurns((current) => (current.at(-1)?.role === "user" ? current.slice(0, -1) : current));
    void send(question);
  }

  function reset() {
    setTurns([]);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <section aria-labelledby={`${inputId}-title`} className="flex flex-col rounded-lg border border-slate-200 bg-white">
      <header className="flex items-start gap-4 border-b border-slate-100 p-5">
        <Sigi state={sigiState} size={72} className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${inputId}-title`} className="text-base font-semibold text-slate-900">
              Policy Copilot
            </h2>
            <StatusBadge label="AI-generated · verify before use" tone="warning" />
          </div>
          <p className="text-sm text-slate-600">
            Answers questions about <span className="font-medium text-slate-800">{place}</span> ({disease}) using
            the curated evidence listed for this LGU. It does not make decisions, declare outbreaks or recommend
            spending.
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

      <div className="flex flex-col gap-4 p-5">
        {turns.length > 0 && (
          <ol role="log" aria-label="Conversation" className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto">
            {turns.map((turn, i) => (
              <li key={i} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                {turn.role === "user" ? (
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
                    {turn.content}
                  </p>
                ) : (
                  <div className="w-full max-w-[95%] rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{turn.content}</p>
                    <AnswerProvenance turn={turn} />
                  </div>
                )}
              </li>
            ))}
            {sending && (
              <li className="text-sm text-slate-500" aria-hidden="true">
                Asking the copilot…
              </li>
            )}
          </ol>
        )}

        {error && (
          <div
            className={cn(
              "flex flex-wrap items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm",
              unavailable ? "border-slate-200 bg-slate-50 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            <p className="min-w-0 flex-1">{error.message}</p>
            {!unavailable && (
              <Button variant="ghost" onClick={retry} className="h-8 px-2 text-xs">
                <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Try again
              </Button>
            )}
          </div>
        )}

        {turns.length === 0 && !unavailable && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-slate-500">Suggested questions</p>
            <ul className="flex flex-wrap gap-2">
              {suggestions.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => send(q)}
                    disabled={sending}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-left text-xs text-slate-700 hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
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
            rows={3}
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
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:bg-slate-50 disabled:text-slate-400"
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

/** What an answer was based on, as reported by the API, plus any cited records. */
function AnswerProvenance({ turn }: { turn: Turn }) {
  if (!turn.meta) return null;
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
      <p>
        <span className="font-medium text-slate-600">Based on:</span> {turn.meta.contextScope}
      </p>
      {turn.cited && turn.cited.length > 0 ? (
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-slate-600">Evidence referenced:</span>
          {turn.cited.map((r) => (
            <a key={r.evidenceId} href={`#evidence-${r.evidenceId}`} className="rounded bg-white px-1.5 py-0.5 text-accent ring-1 ring-slate-200 hover:underline">
              {r.sourceTitle}
            </a>
          ))}
        </p>
      ) : (
        <p>This answer does not cite a curated evidence record by id.</p>
      )}
      <details>
        <summary className="cursor-pointer text-slate-600 hover:text-slate-800">
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
