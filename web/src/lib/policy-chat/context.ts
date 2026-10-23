import "server-only";

import { getLguById } from "@/data/demo-lgus";
import { getSignal, DEMO_DISEASES, getLocationIdsForDisease } from "@/data/demo-signals";
import { getTrendSeries } from "@/data/demo-trends";
import { getNeighborSummaries } from "@/lib/neighbors";
import { OPENDENGUE_META, dataProvider } from "@/data/opendengue-provider";
import { SOURCE_CATALOG } from "@/data/source-catalog";
import { getPolicyEvidenceByLocation } from "@/data/policy-evidence";
import type { Signal, LGU } from "@/types";

export const SUPPORTED_DISEASES = DEMO_DISEASES;

export function getSupportedLguIdsForDisease(disease: string): string[] {
  return getLocationIdsForDisease(disease);
}

export function isValidDisease(value: string): boolean {
  return DEMO_DISEASES.includes(value);
}

export function isValidLgu(value: string): boolean {
  return Boolean(getLguById(value));
}

export interface PolicyChatContext {
  disease: string;
  locationId: string;
  lgu: LGU | undefined;
  signal: Signal | undefined;
  trendPoints: number;
  /** Same disease only; a null status/change means no signal in the window, not "normal". */
  neighbors: { name: string; status: string | null; changePercent: number | null; date: string | null }[];
  formalSource: { name: string; version: string; period: string } | null;
  sources: { name: string; status: string; purpose: string }[];
  policyEvidence: Array<{
    id: string;
    claim: string;
    sourceTitle: string;
    issuingOrganization: string;
    sourceUrl: string | null;
    publicationDate: string | null;
    referencePeriod: string | null;
    verificationStatus: string;
    caveats: string[];
    unresolvedQuestions: string[];
    topic: string;
  }>;
  isSample: boolean;
  hasAnomalyResults: boolean;
  limitations: string[];
}

export async function buildPolicyChatContext(
  disease: string,
  locationId: string,
): Promise<PolicyChatContext> {
  const lgu = getLguById(locationId);
  const signal = getSignal(disease, locationId);
  const trend = getTrendSeries(locationId);
  const neighbors = getNeighborSummaries(locationId, disease, { asOf: signal?.date }).map((n) => ({
    name: n.locationName,
    status: n.status,
    changePercent: n.changePercent,
    date: n.date,
  }));

  let formalSource: PolicyChatContext["formalSource"] = null;
  let hasAnomalyResults = false;
  try {
    const observations = await dataProvider.getHealthObservations("dengue", "ph");
    const anomalies = await dataProvider.getAnomalyResults("dengue", "ph");
    hasAnomalyResults = anomalies.length > 0;
    if (observations.length > 0) {
      const latest = observations.at(-1)!;
      formalSource = {
        name: OPENDENGUE_META.source,
        version: OPENDENGUE_META.version,
        period: `${latest.periodStart} → ${latest.periodEnd}`,
      };
    }
  } catch {
    // ignore
  }

  // The same catalogue GET /api/v1/sources serves, so the copilot and the API agree.
  const sources = SOURCE_CATALOG.map((s) => ({
    name: s.name,
    status: s.status,
    purpose: s.purpose,
  }));

  const policyEvidence = getPolicyEvidenceByLocation(locationId)
    .filter((r) => r.locationId === locationId)
    .map((r) => ({
      id: r.evidenceId,
      claim: r.claim,
      sourceTitle: r.sourceTitle,
      issuingOrganization: r.issuingOrganization,
      sourceUrl: r.sourceUrl,
      publicationDate: r.publicationDate,
      referencePeriod: r.referencePeriod,
      verificationStatus: r.verificationStatus,
      caveats: r.caveats,
      unresolvedQuestions: r.unresolvedQuestions,
      topic: r.topic,
    }));

  const limitations: string[] = [];
  if (signal) {
    limitations.push(
      "The signal is derived from demo (illustrative) open-source data, not from verified case counts.",
    );
  } else {
    limitations.push(
      "No demo signal exists for this disease/LGU combination; treat the chat as general public-health reasoning only.",
    );
  }
  if (!formalSource) {
    limitations.push(
      "No formal (surveillance) observations are available for this location; only demo signals and general reasoning can be supplied.",
    );
  }
  if (!hasAnomalyResults) {
    limitations.push(
      "No anomaly or forecast model has been fitted; SIGMA cannot report a model-derived anomaly score.",
    );
  }
  limitations.push(
    "SIGMA does not confirm outbreaks, diagnose patients, or prescribe policy.",
  );
  limitations.push(
    "All case counts, populations, and facility figures in this context are illustrative demo values, not real public-health statistics.",
  );

  return {
    disease,
    locationId,
    lgu,
    signal,
    trendPoints: trend.length,
    neighbors,
    formalSource,
    sources,
    policyEvidence,
    isSample: true,
    hasAnomalyResults,
    limitations,
  };
}
