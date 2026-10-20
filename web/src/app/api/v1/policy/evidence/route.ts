import { withErrors } from "@/lib/api/route";
import { ApiError } from "@/lib/api/envelope";
import { assertKnownParams, parseQuery } from "@/lib/api/query";
import { getAllPolicyEvidence, POLICY_RESEARCH_PACK } from "@/data/policy-evidence";
import type { VerificationStatus } from "@/lib/policy-evidence/types";

const KNOWN_PARAMS = ["locationId", "topic", "verificationStatus"] as const;

const ALLOWED_TOPICS = [
  "policy_adoption_mandate",
  "implementation_organizational",
  "surveillance_reporting",
  "budget_procurement_fiscal",
  "reported_outcomes",
  "governance_accountability",
  "evidence_gaps_unresolved",
] as const;

const ALLOWED_VERIFICATION: VerificationStatus[] = ["verified", "partially_verified", "needs_review"];

export const GET = withErrors(async (request: Request) => {
  const url = new URL(request.url);
  const query = parseQuery(url);
  assertKnownParams(query, KNOWN_PARAMS);

  let records = getAllPolicyEvidence();

  const locationId = query.get("locationId");
  if (locationId !== undefined) {
    records = records.filter((r: any) => r.locationId === locationId || r.locationId === null);
  }

  const topic = query.get("topic");
  if (topic !== undefined) {
    if (!(ALLOWED_TOPICS as readonly string[]).includes(topic)) {
      throw ApiError.badRequest(`"topic" must be one of: ${ALLOWED_TOPICS.join(", ")}.`, {
        topic: [`expected one of ${ALLOWED_TOPICS.join(", ")}`],
      });
    }
    records = records.filter((r: any) => r.topic === topic);
  }

  const verificationStatus = query.get("verificationStatus");
  if (verificationStatus !== undefined) {
    if (!ALLOWED_VERIFICATION.includes(verificationStatus as VerificationStatus)) {
      throw ApiError.badRequest(
        `"verificationStatus" must be one of: ${ALLOWED_VERIFICATION.join(", ")}.`,
        { verificationStatus: [`expected one of ${ALLOWED_VERIFICATION.join(", ")}`] },
      );
    }
    records = records.filter((r: any) => r.verificationStatus === verificationStatus);
  }

  return {
    data: {
      researchPack: POLICY_RESEARCH_PACK,
      records,
      limitations: POLICY_RESEARCH_PACK.limitations,
    },
    status: "demo" as const,
    isSample: true,
  };
});
