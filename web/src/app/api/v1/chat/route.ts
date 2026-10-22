import type { NextRequest } from "next/server";
import { completeChat, parseChatRequest } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/envelope";
import { LIMITS } from "@/lib/api/query";
import { methodNotAllowed, withErrors } from "@/lib/api/route";

/**
 * POST /api/v1/chat
 *
 * The Policy Copilot. The request body is validated before any model call,
 * and the response states what context the model actually received. When no
 * model provider is configured the request is refused rather than answered
 * with a placeholder reply.
 */
import { rateLimited } from "@/lib/api/chat";

export const POST = withErrors(async (request: NextRequest) => {
  if (process.env.CHAT_DISABLED === "true" || process.env.CHAT_PUBLIC_DISABLED === "true") {
    throw ApiError.notConfigured(
      "The Policy Copilot is temporarily disabled and cannot answer requests.",
    );
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0]?.trim() || null
    : request.headers.get("x-real-ip")?.trim() || null;
  const retryAfter = rateLimited(ip);
  if (retryAfter !== null) {
    throw ApiError.rateLimited("Too many requests. Please try again later.", retryAfter);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > LIMITS.maxBodyBytes) {
    throw ApiError.payloadTooLarge("The request body is too large.");
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    throw ApiError.badRequest("A valid JSON body is required.");
  }
  if (new TextEncoder().encode(rawBody).length > LIMITS.maxBodyBytes) {
    throw ApiError.payloadTooLarge("The request body is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw ApiError.badRequest("A valid JSON body is required.");
  }

  const parsed = parseChatRequest(body);

  const data = await completeChat({
    request: parsed,
    config: {
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL,
    },
  });

  return { data, status: "demo" as const, isSample: true };
});

export const GET = methodNotAllowed(["POST"]);
