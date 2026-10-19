import "server-only";

import { getLguById } from "@/data/demo-lgus";
import { getSignal, DEMO_DISEASES, getLocationIdsForDisease } from "@/data/demo-signals";
import { getTrendSeries } from "@/data/demo-trends";
import { getNeighborSummaries } from "@/lib/neighbors";
import { OPENDENGUE_META, dataProvider } from "@/data/opendengue-provider";
import { SOURCE_CATALOG } from "@/data/source-catalog";
import type { Signal, LGU } from "@/types";

/** Supported disease display names, derived from the real demo dataset. */
export const SUPPORTED_DISEASES = DEMO_DISEASES;

/** Supported LGU identifiers for a given disease, matching the UI selector. */
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
  neighbors: { name: string; status: string; changePercent: number }[];
  formalSource: { name: string; version: string; period: string } | null;
  sources: { name: string; status: string; purpose: string }[];
  isSample: boolean;
  hasAnomalyResults: boolean;
  limitations: string[];
}

/**
 * Builds the evidence context the server injects into the system prompt.
 * Only verified project data is included; nothing is invented.
 */
export async function buildPolicyChatContext(
  disease: string,
  locationId: string,
): Promise<PolicyChatContext> {
  const lgu = getLguById(locationId);
  const signal = getSignal(disease, locationId);
  const trend = getTrendSeries(locationId);
  const neighbors = getNeighborSummaries(locationId).map((n) => ({
    name: n.locationName,
    status: n.status,
    changePercent: n.changePercent,
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
    // Formal source unavailable; context reflects that honestly.
  }

  const sources = SOURCE_CATALOG.map((s) => ({
    name: s.name,
    status: s.status,
    purpose: s.purpose,
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
    isSample: true,
    hasAnomalyResults,
    limitations,
  };
}