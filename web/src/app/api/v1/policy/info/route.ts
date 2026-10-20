import { buildPolicyInfoWithAreas } from "@/lib/api/policy";
import { withErrors } from "@/lib/api/route";

/**
 * GET /api/v1/policy/info
 *
 * Assessment areas, evidence summary, supported diseases and the AI
 * disclosure. Everything behind these areas is demo data, and the payload
 * says so.
 */
export const GET = withErrors(async () => {
  const data = await buildPolicyInfoWithAreas();
  return { data, status: "demo" as const, isSample: true };
});
