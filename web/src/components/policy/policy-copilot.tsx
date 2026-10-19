"use client";

import { useMemo, useState } from "react";
import { Send, MessageCircle, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "What should the LGU verify before acting on this signal?",
  "Draft a short briefing for the municipal health officer.",
  "What evidence is missing or unreliable?",
  "What should the LGU monitor over the next few weeks?",
  "What proportionate response could the LGU consider?",
  "Could this signal be explained by incomplete reporting or a backlog?",
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PolicyCopilotProps {
  disease: string;
  locationId: string;
  locationName?: string;
  hasSignal: boolean;
}

export function PolicyCopilot({
  disease,
  locationId,
  locationName,
  hasSignal,
}: PolicyCopilotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextLabel = useMemo(() => {
    const loc = locationName ?? locationId;
    return `${loc} · ${disease}`;
  }, [locationName, locationId, disease]);

  const promptSuggestions = useMemo(() => {
    return SUGGESTED_PROMPTS.map((p) => {
      if (!hasSignal) {
        return p.replace("this signal", "this context");
      }
      return p;
    });
  }, [hasSignal]);

  async function sendMessage(messageText?: string) {
    const text = (messageText ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMessage];

    setMessages(nextHistory);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/policy-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
          disease,
          locationId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = data.error || "Failed to generate response. Please try again.";
        setError(errMsg);
        return;
      }

      if (data.reply) {
        setMessages([
          ...nextHistory,
          { role: "assistant", content: data.reply },
        ]);
      } else {
        setError("Received empty response from server.");
      }
    } catch {
      setError("Network error while contacting the Policy Copilot.");
    } finally {
      setIsLoading(false);
    }
  }

  function clearConversation() {
    setMessages([]);
    setError(null);
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-accent" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">SIGMA Policy Copilot</h2>
            <StatusBadge label="Evidence-aware" tone="info" />
          </div>
          <p className="text-xs text-slate-500">
            Supports evidence-informed analysis, not autonomous policy decisions. Context: {contextLabel}
          </p>
          {!hasSignal && (
            <p className="text-xs text-amber-600">
              No signal detected for this combination; treat responses as general reasoning only.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost"  onClick={clearConversation} disabled={messages.length === 0 && !error}>
            New conversation
          </Button>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="flex max-h-[480px] flex-col gap-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/40 p-3">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow-sm",
                  msg.role === "user" ? "bg-accent text-white" : "bg-white text-slate-800 border border-slate-200"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Generating response...
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
            {error.toLowerCase().includes("groq_api_key") && (
              <p className="mt-1 text-xs text-amber-700">
                Set GROQ_API_KEY (and optionally GROQ_MODEL) in web/.env.local, then restart the dev server.
              </p>
            )}
          </div>
          <Button variant="ghost"  onClick={() => setError(null)} className="h-7 px-2 text-xs">
            Dismiss
          </Button>
        </div>
      )}

      {!messages.length && !error && (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <p className="text-sm font-medium text-slate-700">Suggested prompts</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {promptSuggestions.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => sendMessage(p)}
                disabled={isLoading}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm transition hover:border-accent hover:bg-accent/5 disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
        <label htmlFor="policy-copilot-input" className="sr-only">
          Ask the Policy Copilot
        </label>
        <textarea
          id="policy-copilot-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask about this context... (Ctrl/Cmd+Enter to send)"
          rows={2}
          className="flex-1 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          disabled={isLoading}
        />
        <Button type="submit" disabled={!input.trim() || isLoading}>
          <Send className="mr-2 h-4 w-4" />
          Send
        </Button>
      </form>
    </Card>
  );
}
