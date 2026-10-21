import type { PolicyInfoData, PolicyInsightRecord } from "@sigma/contracts";
import { DEMO_EVIDENCE_SUMMARY, DEMO_POLICY_INSIGHTS, SIGMA_DOES_NOT } from "@/data/demo-policy";
import { DEMO_DISEASES, getLocationIdsForDisease } from "@/data/demo-signals";
import { dataProvider } from "@/data/opendengue-provider";
import { buildSources } from "./sources";

/**
 * Policy service layer.
 *
 * The policy module is demo-backed: every insight is an assessment prompt,
 * never an instruction, and the AI output is never presented as a verified
 * government position. The disclosure travels in the payload so a client
 * cannot drop it.
 */

export const POLICY_AI_DISCLOSURE =
  "Policy Copilot output is AI-generated analysis over demo evidence. It is not a verified government position, not an official advisory, and not a clinical or legal recommendation. A public-health professional must verify everything before it is used.";

export const POLICY_SOURCE = "SIGMA demo evidence base (prototype)";

export const POLICY_SOURCE_NOTE =
  "Areas for assessment are derived from simulated open-source signals and simulated facility inventory. They are review prompts for a human analyst, not findings about a real locality.";

export const POLICY_LIMITATIONS = [
  "Every signal, trend and facility figure behind these assessment areas is simulated.",
  "No formal surveillance is connected at sub-national level, so nothing here is evidence of a real outbreak.",
  "The list of areas for assessment is a fixed prototype set; it is not computed from live data.",
  "A policy copilot can help frame questions. It cannot choose a policy, and it cannot verify anything.",
];

export function buildPolicyInfo(): PolicyInfoData {
  const areasForAssessment: PolicyInsightRecord[] = DEMO_POLICY_INSIGHTS.map((insight) => ({
    category: insight.category,
    title: insight.title,
    rationale: insight.rationale,
    evidenceType: insight.evidenceType,
    assessmentStatus: insight.assessmentStatus,
  }));

  return {
    scope: {
      isSample: true,
      source: POLICY_SOURCE,
      sourceNote: POLICY_SOURCE_NOTE,
      aiDisclosure: POLICY_AI_DISCLOSURE,
    },
    evidenceSummary: [...DEMO_EVIDENCE_SUMMARY],
    areasForAssessment,
    whatSigmaDoesNot: [...SIGMA_DOES_NOT],
    supportedDiseases: [...DEMO_DISEASES],
    chatScope: DEMO_DISEASES.map((disease) => ({
      disease,
      locationIds: getLocationIdsForDisease(disease),
    })),
    areas: [],
    sources: buildSources(),
    limitations: [...POLICY_LIMITATIONS],
  };
}

/** Adds the real LGU list to the policy payload. */
export async function buildPolicyInfoWithAreas(): Promise<PolicyInfoData> {
  const info = buildPolicyInfo();
  const lgus = await dataProvider.getLgus();
  return {
    ...info,
    areas: lgus.map((l) => ({
      id: l.id,
      name: l.name,
      province: l.province,
      region: l.region,
    })),
  };
}
