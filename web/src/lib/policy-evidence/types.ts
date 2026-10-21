export type PolicyEvidenceTopic =
  | "policy_adoption_mandate"
  | "implementation_organizational"
  | "surveillance_reporting"
  | "budget_procurement_fiscal"
  | "reported_outcomes"
  | "governance_accountability"
  | "evidence_gaps_unresolved";

export type VerificationStatus = "verified" | "partially_verified" | "needs_review";

export type EvidencePeriodRelation = "historical" | "current" | "after_surveillance_period" | "unknown";

export type FinancialStage =
  | "appropriation"
  | "approved_budget"
  | "annual_investment_program"
  | "procurement_plan"
  | "contract_award_purchase_order"
  | "obligation"
  | "delivery_inspection_acceptance"
  | "disbursement_payment"
  | "actual_expenditure"
  | "unknown";

export interface PolicyEvidenceRecord {
  evidenceId: string;
  researchPackId: string;
  researchPackVersion: string;
  locationId: string | null;
  entityName: string;
  geographicLevel: "national" | "city" | "municipal" | "province" | "region" | "unknown";
  topic: PolicyEvidenceTopic;
  claim: string;
  sourceTitle: string;
  issuingOrganization: string;
  sourceUrl: string | null;
  sourceRef: string | null;
  publicationDate: string | null;
  referencePeriod: string | null;
  dateReviewed: string;
  evidenceType: string;
  verificationStatus: VerificationStatus;
  verifiedWhat: string[];
  unverifiedWhat: string[];
  limitations: string[];
  caveats: string[];
  unresolvedQuestions: string[];
  notes: string[];
  relationToSurveillancePeriod: EvidencePeriodRelation;
  financialStage: FinancialStage | null;
  amount: string | null;
  sourceIds: string[];
  supersedes?: string[];
  supersededBy?: string;
}
