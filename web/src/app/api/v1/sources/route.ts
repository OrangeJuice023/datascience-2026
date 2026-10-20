import { buildSources } from "@/lib/api/sources";
import { withErrors } from "@/lib/api/route";

/**
 * GET /api/v1/sources
 *
 * The source catalogue: what each source is for, how far it is from being
 * usable, and what it cannot answer. Statuses match reality — a planned
 * source stays `planned`.
 */
export const GET = withErrors(async () => {
  return { data: { sources: buildSources() }, status: "live" as const, isSample: false };
});
