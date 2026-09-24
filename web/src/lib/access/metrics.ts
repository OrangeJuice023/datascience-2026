import type {
  AccessConfidence,
  AccessGapLevel,
  AccessMetric,
  Availability,
  Facility,
  FreshnessStatus,
  InventorySnapshot,
  MedicineSearchEvent,
  QuantityBucket,
} from "@/types/access";

/**
 * ACCESS calculations. Pure and deterministic; run on the server.
 *
 * Demo-mode access-gap rule (illustrative, not clinically validated):
 *
 *   coverage   = facilities with a current (fresh/aging) report ÷ facilities
 *   available  = current reports of available or low ÷ current reports
 *   notFound   = searches that found nothing nearby ÷ searches
 *   demand     = searches ÷ the area's own mean over the first two weeks
 *
 *   if searches < MIN_SEARCHES                      → low (too little demand to judge)
 *   else if coverage < MIN_COVERAGE                 → insufficient_data (never assert a gap on thin data)
 *   else if demand ≥ 1.5 and available ≤ 1/3 and notFound ≥ 0.4 → elevated
 *   else if (demand ≥ 1.2 and available < 2/3) or notFound ≥ 0.25 → moderate
 *   else                                            → low
 *
 *   confidence: high if coverage ≥ 0.8 and searches ≥ 20; medium if coverage ≥ 0.5; else low.
 *
 * Stale reports count toward uncertainty (lower coverage), never toward
 * unavailability. A failed search is a demand/access signal, not a shortage.
 */
export const ACCESS_RULES = {
  minSearches: 8,
  minCoverage: 0.5,
  elevated: { demand: 1.5, maxAvailableShare: 1 / 3, notFoundShare: 0.4 },
  moderate: { demand: 1.2, maxAvailableShare: 2 / 3, notFoundShare: 0.25 },
  confidence: { highCoverage: 0.8, highSearches: 20, mediumCoverage: 0.5 },
} as const;

export function freshnessAt(
  updatedAt: string | null,
  asOf: string,
  thresholds: { fresh: number; aging: number },
): FreshnessStatus {
  if (!updatedAt) return "unknown";
  const hours = (Date.parse(asOf) - Date.parse(updatedAt)) / 3_600_000;
  if (hours < 0) return "unknown";
  if (hours < thresholds.fresh) return "fresh";
  if (hours <= thresholds.aging) return "aging";
  return "stale";
}

export interface FacilityState {
  facilityId: string;
  medicineId: string;
  weekIndex: number;
  /** Latest reported state as of the week end; unknown when never reported. */
  availability: Availability;
  quantityBucket: QuantityBucket | null;
  updatedAt: string | null;
  freshness: FreshnessStatus;
  /** Hours between the report and the week end; null when never reported. */
  ageHours: number | null;
}

/** Latest report per facility × medicine as of each week end. */
export function facilityStates(
  facilities: Facility[],
  medicineIds: string[],
  snapshots: InventorySnapshot[],
  weeks: Array<{ index: number; asOf: string }>,
  thresholds: { fresh: number; aging: number },
): FacilityState[] {
  const byKey = new Map<string, InventorySnapshot[]>();
  for (const s of snapshots) {
    const key = `${s.facilityId}|${s.medicineId}`;
    const list = byKey.get(key) ?? [];
    list.push(s);
    byKey.set(key, list);
  }
  for (const list of byKey.values()) list.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  return facilities.flatMap((f) =>
    medicineIds.flatMap((medicineId) =>
      weeks.map((week): FacilityState => {
        const latest = (byKey.get(`${f.id}|${medicineId}`) ?? [])
          .filter((s) => s.updatedAt <= week.asOf)
          .at(-1);
        return {
          facilityId: f.id,
          medicineId,
          weekIndex: week.index,
          availability: latest?.availability ?? "unknown",
          quantityBucket: latest?.quantityBucket ?? null,
          updatedAt: latest?.updatedAt ?? null,
          freshness: freshnessAt(latest?.updatedAt ?? null, week.asOf, thresholds),
          ageHours: latest ? Math.round((Date.parse(week.asOf) - Date.parse(latest.updatedAt)) / 3_600_000) : null,
        };
      }),
    ),
  );
}

function classify(
  searches: number,
  coverage: number,
  demand: number,
  availableShare: number,
  notFoundShare: number,
): AccessGapLevel {
  const r = ACCESS_RULES;
  if (searches < r.minSearches) return "low";
  if (coverage < r.minCoverage) return "insufficient_data";
  if (demand >= r.elevated.demand && availableShare <= r.elevated.maxAvailableShare && notFoundShare >= r.elevated.notFoundShare) {
    return "elevated";
  }
  if ((demand >= r.moderate.demand && availableShare < r.moderate.maxAvailableShare) || notFoundShare >= r.moderate.notFoundShare) {
    return "moderate";
  }
  return "low";
}

function confidenceFor(coverage: number, searches: number): AccessConfidence {
  const c = ACCESS_RULES.confidence;
  if (coverage >= c.highCoverage && searches >= c.highSearches) return "high";
  if (coverage >= c.mediumCoverage) return "medium";
  return "low";
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function computeAccessMetrics({
  facilities,
  medicineIds,
  states,
  events,
  weeks,
  psgcByArea,
}: {
  facilities: Facility[];
  medicineIds: string[];
  states: FacilityState[];
  events: MedicineSearchEvent[];
  weeks: Array<{ index: number; periodStart: string; periodEnd: string }>;
  psgcByArea: Record<string, string | null>;
}): AccessMetric[] {
  const areaIds = [...new Set(facilities.map((f) => f.areaId))];
  const facilitiesByArea = new Map(areaIds.map((a) => [a, facilities.filter((f) => f.areaId === a)]));
  const stateKey = (fid: string, mid: string, w: number) => `${fid}|${mid}|${w}`;
  const stateMap = new Map(states.map((s) => [stateKey(s.facilityId, s.medicineId, s.weekIndex), s]));

  const eventCounts = new Map<string, { total: number; notFound: number }>();
  for (const e of events) {
    const week = weeks.find((w) => e.timestamp.slice(0, 10) >= w.periodStart && e.timestamp.slice(0, 10) <= w.periodEnd);
    if (!week) continue;
    const key = `${e.areaId}|${e.medicineId}|${week.index}`;
    const c = eventCounts.get(key) ?? { total: 0, notFound: 0 };
    c.total++;
    if (e.resultType === "not_found_nearby") c.notFound++;
    eventCounts.set(key, c);
  }

  return areaIds.flatMap((areaId) =>
    medicineIds.flatMap((medicineId) => {
      const early = [0, 1].map((w) => eventCounts.get(`${areaId}|${medicineId}|${w}`)?.total ?? 0);
      const baseline = Math.max(1, (early[0] + early[1]) / 2);
      return weeks.map((week): AccessMetric => {
        const areaFacilities = facilitiesByArea.get(areaId) ?? [];
        const areaStates = areaFacilities
          .map((f) => stateMap.get(stateKey(f.id, medicineId, week.index)))
          .filter((s): s is FacilityState => Boolean(s));
        const current = areaStates.filter((s) => s.freshness === "fresh" || s.freshness === "aging");
        const confirmedAvailable = current.filter((s) => s.availability === "available" || s.availability === "low").length;
        const reportedUnavailable = current.filter((s) => s.availability === "unavailable").length;
        const staleInventory = areaStates.filter((s) => s.freshness === "stale").length;
        const unknownInventory = areaStates.filter((s) => s.freshness === "unknown" || s.availability === "unknown").length;
        const n = areaFacilities.length || 1;
        const coverage = current.length / n;
        const counts = eventCounts.get(`${areaId}|${medicineId}|${week.index}`) ?? { total: 0, notFound: 0 };
        const demand = counts.total / baseline;
        const availableShare = current.length ? confirmedAvailable / current.length : 0;
        const notFoundShare = counts.total ? counts.notFound / counts.total : 0;
        const accessGap = classify(counts.total, coverage, demand, availableShare, notFoundShare);
        const confidence = confidenceFor(coverage, counts.total);

        const reasons: string[] = [];
        if (accessGap === "insufficient_data") {
          reasons.push(`Only ${pct(coverage)} of participating facilities have a current report`);
          if (staleInventory > 0) reasons.push(`${staleInventory} facility report(s) are stale; availability may be outdated`);
        } else {
          if (demand >= ACCESS_RULES.moderate.demand) reasons.push(`Search demand is ${demand.toFixed(1)}x this area's early-period level`);
          if (notFoundShare >= ACCESS_RULES.moderate.notFoundShare) reasons.push(`${pct(notFoundShare)} of searches found nothing nearby`);
          if (current.length && availableShare < ACCESS_RULES.moderate.maxAvailableShare) {
            reasons.push(`${confirmedAvailable} of ${current.length} current facility reports confirm availability`);
          }
          if (coverage >= ACCESS_RULES.confidence.highCoverage) reasons.push("Facility reporting coverage is sufficient to assess");
          if (staleInventory > 0) reasons.push(`${staleInventory} facility report(s) are stale and not counted as unavailable`);
          if (counts.total < ACCESS_RULES.minSearches) reasons.push("Too few searches to assess an access gap");
        }

        return {
          medicineId,
          areaId,
          psgcCode: psgcByArea[areaId] ?? null,
          periodStart: week.periodStart,
          periodEnd: week.periodEnd,
          searchDemand: counts.total,
          notFoundSearches: counts.notFound,
          demandRatio: Math.round(demand * 100) / 100,
          facilities: areaFacilities.length,
          confirmedAvailable,
          reportedUnavailable,
          staleInventory,
          unknownInventory,
          facilityCoverage: Math.round(coverage * 100) / 100,
          accessGap,
          confidence,
          reasons,
          isSample: true,
        };
      });
    }),
  );
}
