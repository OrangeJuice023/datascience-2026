import { withErrors } from "@/lib/api/route";
import { ApiError } from "@/lib/api/envelope";
import { assertKnownParams, parseQuery } from "@/lib/api/query";
import { getAllPolicyEvidence, POLICY_RESEARCH_PACK } from "@/data/policy-evidence";
import type { PolicyEvidenceRecord } from "@/lib/policy-evidence/types";
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

  let records: PolicyEvidenceRecord[] = getAllPolicyEvidence();

  const locationId = query.get("locationId");
  if (locationId !== undefined) {
    records = records.filter((r: PolicyEvidenceRecord) => r.locationId === locationId || r.locationId === null);
  }

  const topic = query.get("topic");
  if (topic !== undefined) {
    if (!(ALLOWED_TOPICS as readonly string[]).includes(topic)) {
      throw ApiError.badRequest(`"topic" must be one of: ${ALLOWED_TOPICS.join(", ")}.`, {
        topic: [`expected one of ${ALLOWED_TOPICS.join(", ")}`],
      });
    }
    records = records.filter((r: PolicyEvidenceRecord) => r.topic === (topic as PolicyEvidenceRecord["topic"]));
  }

  const verificationStatus = query.get("verificationStatus");
  if (verificationStatus !== undefined) {
    if (!ALLOWED_VERIFICATION.includes(verificationStatus as VerificationStatus)) {
      throw ApiError.badRequest(
        `"verificationStatus" must be one of: ${ALLOWED_VERIFICATION.join(", ")}.`,
        { verificationStatus: [`expected one of ${ALLOWED_VERIFICATION.join(", ")}`] },
      );
    }
    records = records.filter((r: PolicyEvidenceRecord) => r.verificationStatus === (verificationStatus as VerificationStatus));
  }

  return {
    data: {
      researchPack: {
        id: POLICY_RESEARCH_PACK.id,
        version: POLICY_RESEARCH_PACK.version,
        name: POLICY_RESEARCH_PACK.name,
        ingestedOn: POLICY_RESEARCH_PACK.ingestedOn,
        sources: POLICY_RESEARCH_PACK.sources,
      },
      records,
      limitations: POLICY_RESEARCH_PACK.limitations,
    },
    // Curated, cited extracts from real documents: reference data, not a simulation.
    status: "live" as const,
    isSample: false,
  };
});
