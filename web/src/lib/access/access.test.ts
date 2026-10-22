import { describe, expect, it } from "vitest";
import type { LGU } from "@/types";
import type { Facility, InventorySnapshot, MedicineSearchEvent, Medicine } from "@/types/access";
import { ACCESS_SCOPE_DOES_NOT_SUPPORT, buildAccessMetrics } from "@/lib/api/access";
import { accessAssessments } from "./assessments";
import { packAccessBundle } from "./bundle";
import { computeAccessMetrics, facilityStates } from "./metrics";

/**
 * ACCESS rules, pinned on a small synthetic world (all ids are test fixtures,
 * not real places). The rules that matter most here: a stale report is
 * uncertainty, never unavailability; thin reporting is "insufficient data",
 * never a gap; and every API payload states that the data is simulated.
 */

const THRESHOLDS = { fresh: 48, aging: 168 };
const WEEKS = [
  { index: 0, periodStart: "2026-01-04", periodEnd: "2026-01-10", asOf: "2026-01-10T23:59:59Z" },
  { index: 1, periodStart: "2026-01-11", periodEnd: "2026-01-17", asOf: "2026-01-17T23:59:59Z" },
  { index: 2, periodStart: "2026-01-18", periodEnd: "2026-01-24", asOf: "2026-01-24T23:59:59Z" },
];
const MEDICINE: Medicine = { id: "test-med", name: "Test medicine", category: "test", isSample: true };

function facility(id: string, areaId: string, psgcCode: string | null): Facility {
  return {
    id,
    name: `Test facility ${id}`,
    type: "pharmacy",
    psgcCode,
    areaId,
    latitude: 0,
    longitude: 0,
    source: "test",
    updatedAt: "2026-01-01T00:00:00Z",
    isSample: true,
  };
}

function snapshot(facilityId: string, availability: InventorySnapshot["availability"], updatedAt: string): InventorySnapshot {
  return {
    id: `snap-${facilityId}-${updatedAt}`,
    facilityId,
    medicineId: MEDICINE.id,
    availability,
    quantityBucket: null,
    updatedAt,
    source: "test",
    isSample: true,
  };
}

/** `total` searches in an area during a week, `notFound` of them finding nothing nearby. */
function searches(areaId: string, week: number, total: number, notFound: number): MedicineSearchEvent[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `ev-${areaId}-${week}-${i}`,
    medicineId: MEDICINE.id,
    areaId,
    psgcCode: null,
    timestamp: `${WEEKS[week].periodStart}T12:00:00Z`,
    resultType: i < notFound ? ("not_found_nearby" as const) : ("available_found" as const),
    isSample: true,
  }));
}

const FRESH = "2026-01-24T12:00:00Z"; // 12 h before the last week ends
const STALE = "2025-12-01T00:00:00Z"; // weeks before the last week ends

// Area A: 3 facilities, all fresh; 1 of 3 confirms availability.
// Area B: 3 facilities, only 1 fresh; the 2 stale reports say "unavailable".
const FACILITIES = [
  facility("a1", "area-a", "TEST-PSGC-A"),
  facility("a2", "area-a", "TEST-PSGC-A"),
  facility("a3", "area-a", "TEST-PSGC-A"),
  facility("b1", "area-b", null),
  facility("b2", "area-b", null),
  facility("b3", "area-b", null),
];
const SNAPSHOTS = [
  snapshot("a1", "available", FRESH),
  snapshot("a2", "unavailable", FRESH),
  snapshot("a3", "unavailable", FRESH),
  snapshot("b1", "available", FRESH),
  snapshot("b2", "unavailable", STALE),
  snapshot("b3", "unavailable", STALE),
];

function run(events: MedicineSearchEvent[], facilities = FACILITIES, snapshots = SNAPSHOTS) {
  const states = facilityStates(facilities, [MEDICINE.id], snapshots, WEEKS, THRESHOLDS);
  const metrics = computeAccessMetrics({
    facilities,
    medicineIds: [MEDICINE.id],
    states,
    events,
    weeks: WEEKS,
    psgcByArea: Object.fromEntries(facilities.map((f) => [f.areaId, f.psgcCode])),
  });
  return { states, metrics };
}

const lastWeek = (metrics: ReturnType<typeof run>["metrics"], areaId: string) =>
  metrics.find((m) => m.areaId === areaId && m.periodStart === WEEKS[2].periodStart)!;

// Early-period baseline of 10 searches a week, then a doubling with half not found.
const RISING = [
  ...searches("area-a", 0, 10, 0),
  ...searches("area-a", 1, 10, 0),
  ...searches("area-a", 2, 20, 10),
  ...searches("area-b", 0, 10, 0),
  ...searches("area-b", 1, 10, 0),
  ...searches("area-b", 2, 20, 10),
];

describe("the access-gap rule", () => {
  it("classes rising demand, few confirmations and failed searches as elevated", () => {
    const m = lastWeek(run(RISING).metrics, "area-a");

    expect(m.demandRatio).toBe(2);
    expect(m.facilityCoverage).toBe(1);
    expect(m.confirmedAvailable).toBe(1);
    expect(m.reportedUnavailable).toBe(2);
    expect(m.accessGap).toBe("elevated");
    expect(m.confidence).toBe("high");
  });

  it("reports thin facility coverage as insufficient data, never as a gap", () => {
    const m = lastWeek(run(RISING).metrics, "area-b");

    expect(m.facilityCoverage).toBeCloseTo(0.33, 2);
    expect(m.accessGap).toBe("insufficient_data");
    expect(m.reasons.join(" ")).toMatch(/current report/);
  });

  it("counts a stale report as uncertainty, not as unavailable", () => {
    const m = lastWeek(run(RISING).metrics, "area-b");

    expect(m.staleInventory).toBe(2);
    expect(m.reportedUnavailable).toBe(0);
  });

  it("does not judge a gap from too few searches", () => {
    const few = [...searches("area-a", 0, 3, 0), ...searches("area-a", 1, 3, 0), ...searches("area-a", 2, 5, 5)];
    const m = lastWeek(run(few).metrics, "area-a");

    expect(m.searchDemand).toBe(5);
    expect(m.accessGap).toBe("low");
    expect(m.reasons).toContain("Too few searches to assess an access gap");
  });

  it("classes a high share of failed searches as moderate even with good availability", () => {
    const allAvailable = SNAPSHOTS.map((s) => ({ ...s, availability: "available" as const }));
    const steady = [...searches("area-a", 0, 10, 0), ...searches("area-a", 1, 10, 0), ...searches("area-a", 2, 10, 3)];
    const m = lastWeek(run(steady, FACILITIES, allAvailable).metrics, "area-a");

    expect(m.demandRatio).toBe(1);
    expect(m.accessGap).toBe("moderate");
  });

  it("marks every metric as sample data", () => {
    expect(run(RISING).metrics.every((m) => m.isSample)).toBe(true);
  });
});

function bundleFor(events: MedicineSearchEvent[]) {
  const { states, metrics } = run(events);
  return packAccessBundle({
    isSample: true,
    medicines: [MEDICINE],
    facilities: FACILITIES,
    weeks: WEEKS,
    states,
    metrics,
    freshnessThresholds: THRESHOLDS,
  });
}

describe("areas for assessment (ACCESS → Policy)", () => {
  it("lists only areas with a potential gap, most serious first, as review prompts", () => {
    const assessments = accessAssessments(bundleFor(RISING));

    expect(assessments.map((a) => [a.areaId, a.gap])).toEqual([
      ["area-a", "elevated"],
      ["area-b", "insufficient_data"],
    ]);
    expect(assessments[0].areaForAssessment).toMatch(/^Review /);
    expect(assessments[1].areaForAssessment).toMatch(/reporting coverage/);
  });
});

const LGUS: LGU[] = [
  { id: "area-a", name: "Test Area A", province: "Test Province", region: "Test Region", latitude: 1, longitude: 2 },
  { id: "area-b", name: "Test Area B", province: "Test Province", region: "Test Region", latitude: 3, longitude: 4 },
];

function payload(overrides: Partial<Parameters<typeof buildAccessMetrics>[0]> = {}) {
  const bundle = bundleFor(RISING);
  return buildAccessMetrics({
    bundle,
    assessments: accessAssessments(bundle),
    source: "Test source",
    sourceNote: "Test note",
    lgus: LGUS,
    limit: 1000,
    ...overrides,
  });
}

describe("the ACCESS API payload", () => {
  it("states that the data is simulated and what it cannot support", () => {
    const data = payload();

    expect(data.scope.isSample).toBe(true);
    expect(data.scope.doesNotSupport).toEqual(ACCESS_SCOPE_DOES_NOT_SUPPORT);
    expect(data.scope.coverage).toEqual({ from: "2026-01-04", to: "2026-01-24" });
    expect(data.metrics.every((m) => m.isSample)).toBe(true);
  });

  it("keeps an area's PSGC code instead of dropping it", () => {
    const data = payload();

    expect(data.metrics.filter((m) => m.areaId === "area-a").every((m) => m.psgcCode === "TEST-PSGC-A")).toBe(true);
    expect(data.metrics.filter((m) => m.areaId === "area-b").every((m) => m.psgcCode === null)).toBe(true);
  });

  it("names areas from the geography list", () => {
    const data = payload();

    expect(data.areas.map((a) => [a.id, a.name, a.facilityCount])).toEqual([
      ["area-a", "Test Area A", 3],
      ["area-b", "Test Area B", 3],
    ]);
  });

  it("applies the area filter and the row limit", () => {
    expect(payload({ areaId: "area-b" }).metrics.every((m) => m.areaId === "area-b")).toBe(true);
    expect(payload({ areaId: "area-b" }).areasForAssessment.map((a) => a.areaId)).toEqual(["area-b"]);
    expect(payload({ limit: 2 }).metrics).toHaveLength(2);
  });
});
