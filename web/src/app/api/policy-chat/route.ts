import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { buildPolicyChatContext, getSupportedLguIdsForDisease, isValidDisease, isValidLgu } from "@/lib/policy-chat/context";
import { buildSystemPrompt } from "@/lib/policy-chat/system-prompt";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL = "openai/gpt-oss-20b";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY = 10;
const MAX_COMPLETION_TOKENS = 1500;
const REQUEST_TIMEOUT_MS = 30000;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message?: unknown;
  history?: unknown;
  disease?: unknown;
  locationId?: unknown;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function normalizeMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const role = obj.role;
  const content = obj.content;
  if ((role !== "user" && role !== "assistant") || !isString(content)) return null;
  return { role, content: content.slice(0, MAX_MESSAGE_LENGTH) };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "GROQ_API_KEY is not configured.",
        setup:
          "Set GROQ_API_KEY (and optionally GROQ_MODEL) in your environment, then restart the dev server.",
      },
      { status: 503 },
    );
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = isString(body.message) ? body.message.slice(0, MAX_MESSAGE_LENGTH) : "";
  if (!message.trim()) {
    return NextResponse.json({ error: "A message is required." }, { status: 400 });
  }

  const disease = isString(body.disease) ? body.disease : "";
  const locationId = isString(body.locationId) ? body.locationId : "";
  if (!disease || !isValidDisease(disease)) {
    return NextResponse.json({ error: "Unsupported disease selection." }, { status: 400 });
  }
  if (!locationId || !isValidLgu(locationId)) {
    return NextResponse.json({ error: "Unsupported LGU selection." }, { status: 400 });
  }
  // Extra guard: the LGU must actually have a signal for the chosen disease.
  const supportedLgus = getSupportedLguIdsForDisease(disease);
  if (!supportedLgus.includes(locationId)) {
    return NextResponse.json(
      { error: "No demo data exists for this disease/LGU combination." },
      { status: 400 },
    );
  }

  const history = Array.isArray(body.history)
    ? (body.history.map(normalizeMessage).filter((m): m is ChatMessage => m !== null) as ChatMessage[])
    : [];
  const trimmedHistory = history.slice(-MAX_HISTORY);

  let context: Awaited<ReturnType<typeof buildPolicyChatContext>>;
  try {
    context = await buildPolicyChatContext(disease, locationId);
  } catch (error) {
    return NextResponse.json(
      { error: "Could not assemble evidence context.", detail: error instanceof Error ? error.message : undefined },
      { status: 500 },
    );
  }

  const model = isString(process.env.GROQ_MODEL) && process.env.GROQ_MODEL!.trim()
    ? process.env.GROQ_MODEL!.trim()
    : DEFAULT_MODEL;

  const systemPrompt = buildSystemPrompt(context);
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...trimmedHistory,
    { role: "user" as const, content: message },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ error: "Request to Groq timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: "Network failure reaching Groq." }, { status: 502 });
  }
  clearTimeout(timer);

  if (upstream.status === 429) {
    return NextResponse.json({ error: "Groq rate limit reached. Please try again shortly." }, { status: 429 });
  }
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "Groq request failed.", status: upstream.status, detail: text.slice(0, 500) },
      { status: 502 },
    );
  }

  let data: {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };
  try {
    data = (await upstream.json()) as typeof data;
  } catch {
    return NextResponse.json({ error: "Malformed response from Groq." }, { status: 502 });
  }

  if (data.error?.message) {
    return NextResponse.json({ error: "Groq request failed.", detail: data.error.message }, { status: 502 });
  }

  const content = data.choices?.[0]?.message?.content;
  if (!isString(content) || !content.trim()) {
    return NextResponse.json({ error: "Groq returned an empty response." }, { status: 502 });
  }

  return NextResponse.json({ reply: content, model });
}