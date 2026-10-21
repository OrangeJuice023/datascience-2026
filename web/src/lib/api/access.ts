import type {
  AccessArea,
  AccessAssessmentRecord,
  AccessMetricRecord,
  AccessMetricsData,
} from "@sigma/contracts";
import type { LGU } from "@/types";
import type { AccessBundle, AccessMetricPoint } from "@/lib/access/bundle";
import { GAP_LABEL, areaIds } from "@/lib/access/bundle";
import type { AccessAssessment } from "@/lib/access/assessments";

/**
 * ACCESS service layer.
 *
 * The ACCESS module is a fully wired prototype running on simulated records.
 * Every response therefore carries an explicit scope block stating what the
 * data can and cannot support, so a client cannot present demo coverage as
 * real medicine availability.
 *
 * A facility appearing in a list means only that a demo record exists for it.
 * It does not establish that the facility is operating, stocked, staffed or
 * clinically accessible. That distinction is stated in the response.
 */

export const ACCESS_SCOPE_SUPPORTS = [
  "How many facilities have a current (fresh or aging) report in a given week.",
  "How many of those reports indicate availability, unavailability, or staleness.",
  "Relative search demand per area and medicine, as a demand signal only.",
  "A rule-based gap class (low, moderate, elevated, insufficient data) with an explicit confidence level.",
];

export const ACCESS_SCOPE_DOES_NOT_SUPPORT = [
  "Whether a medicine is actually in stock at a real pharmacy or health centre.",
  "Whether a facility is operating, staffed, or clinically accessible.",
  "A shortage declaration, procurement instruction, or any clinical recommendation.",
  "Any statement about a real LGU, because every record in this module is simulated.",
];

export interface BuildAccessMetricsInput {
  bundle: AccessBundle;
  assessments: AccessAssessment[];
  /** The demo source label, e.g. "Demo inventory (prototype)". */
  source: string;
  sourceNote: string;
  /** SIGMA geography ids of the areas covered by the bundle. */
  lgus: LGU[];
  medicineId?: string;
  areaId?: string;
  limit: number;
}

export function buildAccessMetrics(input: BuildAccessMetricsInput): AccessMetricsData {
  const { bundle } = input;
  const nameById = new Map(input.lgus.map((lgu) => [lgu.id, lgu]));
  const areaName = (id: string) => nameById.get(id)?.name ?? id;

  const areas: AccessArea[] = areaIds(bundle).map((id) => {
    const lgu = nameById.get(id);
    return {
      id,
      name: areaName(id),
      province: lgu?.province ?? "",
      region: lgu?.region ?? "",
      latitude: lgu?.latitude ?? 0,
      longitude: lgu?.longitude ?? 0,
      facilityCount: bundle.facilities.filter((f) => f.areaId === id).length,
    };
  });

  const metrics: AccessMetricRecord[] = [];
  for (const medicine of bundle.medicines) {
    if (input.medicineId && medicine.id !== input.medicineId) continue;
    for (const [areaId, series] of Object.entries(bundle.metrics[medicine.id] ?? {})) {
      if (input.areaId && areaId !== input.areaId) continue;
      series.forEach((point: AccessMetricPoint, weekIndex: number) => {
        const week = bundle.weeks[weekIndex];
        if (!week) return;
        metrics.push({
          medicineId: medicine.id,
          medicineName: medicine.name,
          areaId,
          areaName: areaName(areaId),
          psgcCode: null,
          periodStart: week.periodStart,
          periodEnd: week.periodEnd,
          searchDemand: point.searchDemand,
          notFoundSearches: point.notFoundSearches,
          demandRatio: point.demandRatio,
          facilities: point.facilities,
          confirmedAvailable: point.confirmedAvailable,
          reportedUnavailable: point.reportedUnavailable,
          staleInventory: point.staleInventory,
          unknownInventory: point.unknownInventory,
          facilityCoverage: point.facilityCoverage,
          accessGap: point.accessGap,
          accessGapLabel: GAP_LABEL[point.accessGap],
          confidence: point.confidence,
          reasons: point.reasons,
          isSample: true,
        });
      });
    }
  }

  const assessments: AccessAssessmentRecord[] = input.assessments
    .filter(
      (a) =>
        (!input.medicineId || a.medicineId === input.medicineId) &&
        (!input.areaId || a.areaId === input.areaId),
    )
    .map((a: AccessAssessment) => ({
      areaId: a.areaId,
      areaName: areaName(a.areaId),
      medicineId: a.medicineId,
      medicineName: a.medicineName,
      gap: a.gap,
      gapLabel: a.gapLabel,
      confidence: a.confidence,
      observed: a.observed,
      areaForAssessment: a.areaForAssessment,
    }));

  const weeks = bundle.weeks.map((w) => ({
    index: w.index,
    periodStart: w.periodStart,
    periodEnd: w.periodEnd,
  }));

  return {
    scope: {
      isSample: bundle.isSample,
      source: input.source,
      sourceNote: input.sourceNote,
      areas: areas.length,
      facilities: bundle.facilities.length,
      medicines: bundle.medicines.length,
      weeks: weeks.length,
      coverage: {
        from: weeks[0]?.periodStart ?? "",
        to: weeks[weeks.length - 1]?.periodEnd ?? "",
      },
      supports: [...ACCESS_SCOPE_SUPPORTS],
      doesNotSupport: [...ACCESS_SCOPE_DOES_NOT_SUPPORT],
    },
    medicines: bundle.medicines.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      isSample: m.isSample,
    })),
    areas,
    weeks,
    metrics: metrics.slice(0, input.limit),
    areasForAssessment: assessments,
  };
}
