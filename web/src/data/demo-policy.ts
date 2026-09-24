import type { PolicyInsight } from "@/types";

/**
 * DEMO DATA — illustrative assessment areas only. SIGMA does not prescribe
 * policy; these are framed as areas warranting human review, not actions.
 */
export const DEMO_POLICY_INSIGHTS: PolicyInsight[] = [
  {
    category: "Surveillance",
    title: "Surveillance",
    rationale:
      "Observed signal warrants verification against formal surveillance.",
    evidenceType: "Deviation from historical baseline",
    assessmentStatus: "for-assessment",
  },
  {
    category: "Health communication",
    title: "Health communication",
    rationale:
      "Potentially elevated public concern may warrant review of communication needs.",
    evidenceType: "Source volume and diversity",
    assessmentStatus: "for-assessment",
  },
  {
    category: "Facility readiness",
    title: "Facility readiness",
    rationale:
      "Review service capacity if other indicators also rise.",
    evidenceType: "Sustained multi-period activity",
    assessmentStatus: "monitoring",
  },
  {
    category: "Inter-LGU coordination",
    title: "Inter-LGU coordination",
    rationale: "Neighboring LGUs may show related patterns.",
    evidenceType: "Geographic concentration",
    assessmentStatus: "for-assessment",
  },
];

export const DEMO_EVIDENCE_SUMMARY = [
  "Unusual deviation from historical baseline",
  "Sustained activity across recent reporting periods",
  "Geographic concentration among neighboring areas",
  "Multiple independent source categories reporting related activity",
];

export const SIGMA_DOES_NOT = [
  "It does not confirm outbreaks.",
  "It does not diagnose patients.",
  "It does not prescribe policy.",
  "It does not replace official surveillance.",
  "It does not replace public-health professionals.",
];
