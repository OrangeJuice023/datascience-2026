import { ApiError } from "@/lib/api/envelope";
import { buildPolicyInfo } from "@/lib/api/policy";
import { withErrors } from "@/lib/api/route";
import { readSigmaData } from "@/lib/sigma/summary";

/**
 * GET /api/v1/policy/info
 *
 * The policy evidence summary, the reporting units SIGI can answer about
 * (and which of them have local policy records), the sources and the AI
 * disclosure, all counted from SIGMA's real records.
 */
export const GET = withErrors(async () => {
  const sigma = await readSigmaData();
  if (!sigma) {
    throw new ApiError("unavailable", 503, "The reporting-unit list is not available right now.");
  }
  return { data: buildPolicyInfo(sigma), status: "live" as const, isSample: false };
});
