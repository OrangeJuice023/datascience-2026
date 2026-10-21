import { POLICY_EVIDENCE_RECORDS } from "./registry";

export interface ComparisonRow {
  city: string;
  locationId: string;
  policyAdoption: string;
  implementation: string;
  alertToResponse: string;
  surveillanceReporting: string;
  financial: string;
  outcomes: string;
  gaps: string;
}

export function getComparison(): ComparisonRow[] {
  const cities = [
    { city: "Quezon City", locationId: "quezon-city" },
    { city: "Pasig City", locationId: "pasig" },
    { city: "Davao City", locationId: "davao-city" },
    { city: "Bacolod City", locationId: "bacolod-city" },
  ];
  return cities.map((c) => {
    const recs = POLICY_EVIDENCE_RECORDS.filter((r) => r.locationId === c.locationId);
    const byTopic: Record<string, string[]> = {};
    for (const r of recs) {
      if (!byTopic[r.topic]) byTopic[r.topic] = [];
      byTopic[r.topic].push(`${r.verificationStatus}: ${r.claim} (${r.sourceRef || r.sourceTitle})`);
    }
    const gaps = recs.flatMap((r) => (r.unresolvedQuestions || []).map((q) => `${q} (${r.sourceRef || r.evidenceId})`));
    return {
      city: c.city,
      locationId: c.locationId,
      policyAdoption: (byTopic["policy_adoption_mandate"] || []).join(" | ") || "Not established in reviewed sources.",
      implementation: (byTopic["implementation_organizational"] || []).join(" | ") || "Not established in reviewed sources.",
      alertToResponse: recs.some((r) => r.topic === "governance_accountability" || (r.claim && r.claim.toLowerCase().includes("alert-to-response"))) ? ((byTopic["governance_accountability"] || []).join(" | ")) : "Not established in reviewed sources.",
      surveillanceReporting: (byTopic["surveillance_reporting"] || []).join(" | ") || "Not established in reviewed sources.",
      financial: (byTopic["budget_procurement_fiscal"] || []).join(" | ") || "Not established in reviewed sources.",
      outcomes: (byTopic["reported_outcomes"] || []).join(" | ") || "Not established in reviewed sources.",
      gaps: gaps.length > 0 ? gaps.join(" | ") : "None documented.",
    };
  });
}
