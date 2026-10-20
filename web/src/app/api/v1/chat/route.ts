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
export const POST = withErrors(async (request: NextRequest) => {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > LIMITS.maxBodyBytes) {
    throw ApiError.payloadTooLarge("The request body is too large.");
  }

  let body: unknown;
  try {
    body = await request.json();
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
