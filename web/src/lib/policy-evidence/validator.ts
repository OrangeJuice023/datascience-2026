import type { PolicyEvidenceRecord } from "@/lib/policy-evidence/types";

export interface ValidationIssue {
  code: string;
  message: string;
  evidenceId?: string;
}

const ALLOWED_TOPICS = [
  "policy_adoption_mandate",
  "implementation_organizational",
  "surveillance_reporting",
  "budget_procurement_fiscal",
  "reported_outcomes",
  "governance_accountability",
  "evidence_gaps_unresolved",
];

const ALLOWED_VERIFICATION = ["verified", "partially_verified", "needs_review"];
const ALLOWED_LEVELS = ["national", "city", "municipal", "province", "region", "unknown"];
const ALLOWED_RELATIONS = ["historical", "current", "after_surveillance_period", "unknown"];
const ALLOWED_FINANCIAL = [
  "appropriation",
  "approved_budget",
  "annual_investment_program",
  "procurement_plan",
  "contract_award_purchase_order",
  "obligation",
  "delivery_inspection_acceptance",
  "disbursement_payment",
  "actual_expenditure",
  "unknown",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateRegistry(records: PolicyEvidenceRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const packIds = new Set<string>();

  for (const r of records) {
    if (!r.evidenceId) {
      issues.push({ code: "missing_id", message: "evidence record missing evidenceId" });
      continue;
    }
    if (ids.has(r.evidenceId)) {
      issues.push({ code: "duplicate_id", message: `duplicate evidenceId: ${r.evidenceId}`, evidenceId: r.evidenceId });
    }
    ids.add(r.evidenceId);

    if (!r.researchPackId) {
      issues.push({ code: "missing_research_pack_id", message: "researchPackId is required", evidenceId: r.evidenceId });
    } else {
      packIds.add(r.researchPackId);
    }
    if (!r.researchPackVersion) {
      issues.push({ code: "missing_research_pack_version", message: "researchPackVersion is required", evidenceId: r.evidenceId });
    }
    if (!r.entityName) {
      issues.push({ code: "missing_entity_name", message: "entityName is required", evidenceId: r.evidenceId });
    }
    if (!r.claim) {
      issues.push({ code: "missing_claim", message: "claim is required", evidenceId: r.evidenceId });
    }
    if (!r.sourceTitle) {
      issues.push({ code: "missing_source_title", message: "sourceTitle is required", evidenceId: r.evidenceId });
    }
    if (!r.issuingOrganization) {
      issues.push({ code: "missing_issuing_org", message: "issuingOrganization is required", evidenceId: r.evidenceId });
    }
    if (!r.evidenceType) {
      issues.push({ code: "missing_evidence_type", message: "evidenceType is required", evidenceId: r.evidenceId });
    }
    if (!r.dateReviewed) {
      issues.push({ code: "missing_date_reviewed", message: "dateReviewed is required", evidenceId: r.evidenceId });
    } else if (!ISO_DATE.test(r.dateReviewed)) {
      issues.push({ code: "invalid_date_reviewed", message: "dateReviewed must be ISO YYYY-MM-DD", evidenceId: r.evidenceId });
    }

    if (!(ALLOWED_TOPICS as string[]).includes(r.topic)) {
      issues.push({ code: "invalid_topic", message: `invalid topic: ${r.topic}`, evidenceId: r.evidenceId });
    }
    if (!(ALLOWED_VERIFICATION as string[]).includes(r.verificationStatus)) {
      issues.push({ code: "invalid_verification", message: `invalid verificationStatus: ${r.verificationStatus}`, evidenceId: r.evidenceId });
    }
    if (!(ALLOWED_LEVELS as string[]).includes(r.geographicLevel)) {
      issues.push({ code: "invalid_geographic_level", message: `invalid geographicLevel: ${r.geographicLevel}`, evidenceId: r.evidenceId });
    }
    if (!(ALLOWED_RELATIONS as string[]).includes(r.relationToSurveillancePeriod)) {
      issues.push({ code: "invalid_relation", message: `invalid relationToSurveillancePeriod: ${r.relationToSurveillancePeriod}`, evidenceId: r.evidenceId });
    }
    if (r.financialStage !== null && !(ALLOWED_FINANCIAL as string[]).includes(r.financialStage)) {
      issues.push({ code: "invalid_financial_stage", message: `invalid financialStage: ${r.financialStage}`, evidenceId: r.evidenceId });
    }

    if (r.publicationDate !== null && !ISO_DATE.test(r.publicationDate)) {
      issues.push({ code: "invalid_publication_date", message: "publicationDate must be ISO YYYY-MM-DD or null", evidenceId: r.evidenceId });
    }
    if (r.sourceUrl !== null) {
      if (!isValidUrl(r.sourceUrl)) {
        issues.push({ code: "invalid_source_url", message: "sourceUrl must be a valid http(s) URL or null", evidenceId: r.evidenceId });
      }
    }

    if (r.verificationStatus === "verified" || r.verificationStatus === "partially_verified") {
      if (!Array.isArray(r.verifiedWhat) || r.verifiedWhat.length === 0) {
        issues.push({ code: "missing_verified_what", message: "verified/partially_verified records should have verifiedWhat", evidenceId: r.evidenceId });
      }
      if (!Array.isArray(r.caveats) || r.caveats.length === 0) {
        issues.push({ code: "missing_caveats", message: "verified/partially_verified records should have caveats", evidenceId: r.evidenceId });
      }
    }

    if (r.supersedes && !Array.isArray(r.supersedes)) {
      issues.push({ code: "invalid_supersedes", message: "supersedes must be an array if provided", evidenceId: r.evidenceId });
    }
  }

  // cross-check supersedes/supersededBy
  for (const r of records) {
    if (r.supersedes) {
      for (const sid of r.supersedes) {
        if (!ids.has(sid)) {
          issues.push({ code: "invalid_supersedes_ref", message: `supersedes references unknown id: ${sid}`, evidenceId: r.evidenceId });
        }
      }
    }
    if (r.supersededBy) {
      if (!ids.has(r.supersededBy)) {
        issues.push({ code: "invalid_supersededby_ref", message: `supersededBy references unknown id: ${r.supersededBy}`, evidenceId: r.evidenceId });
      }
    }
  }

  return issues;
}
