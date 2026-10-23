import { chatEnvironment } from "@/lib/api/chat";
import { buildHealth } from "@/lib/api/health";
import { withErrors } from "@/lib/api/route";

/**
 * GET /api/v1/health
 *
 * Reports service availability and configuration flags. It never returns an
 * environment value or a credential.
 */
export const GET = withErrors(async () => {
  const chat = chatEnvironment();
  const data = buildHealth({
    aiProviderConfigured: Boolean(chat.apiKey),
    chatSwitchedOff: chat.switchedOff,
    mapTilesConfigured: Boolean(
      process.env.NEXT_PUBLIC_MAP_STYLE_URL || process.env.NEXT_PUBLIC_MAPTILER_KEY,
    ),
  });
  return { data, status: "live" as const, isSample: false };
});
