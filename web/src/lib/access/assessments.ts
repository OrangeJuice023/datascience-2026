import type { AccessBundle, AccessMetricPoint } from "./bundle";
import { GAP_LABEL } from "./bundle";

/**
 * ACCESS → ACT. Turns the latest week's access indicators into areas for
 * human assessment. SIGMA supports decisions; it does not prescribe them,
 * so the output is always a review prompt, never a procurement or policy
 * instruction.
 */
export interface AccessAssessment {
  areaId: string;
  medicineId: string;
  medicineName: string;
  gap: AccessMetricPoint["accessGap"];
  gapLabel: string;
  confidence: AccessMetricPoint["confidence"];
  /** What was observed, taken from the metric's derived reasons. */
  observed: string[];
  areaForAssessment: string;
}

const PROMPT: Record<"elevated" | "moderate" | "insufficient_data", string> = {
  elevated: "Review participating facility availability and inventory freshness.",
  moderate: "Monitor search demand and confirm current facility availability.",
  insufficient_data: "Improve facility reporting coverage before assessing access.",
};

export function accessAssessments(bundle: AccessBundle, weekIndex = bundle.weeks.length - 1): AccessAssessment[] {
  const order = { elevated: 0, moderate: 1, insufficient_data: 2, low: 3 } as const;
  const out: AccessAssessment[] = [];
  for (const medicine of bundle.medicines) {
    for (const [areaId, series] of Object.entries(bundle.metrics[medicine.id] ?? {})) {
      const m = series[weekIndex];
      if (!m || m.accessGap === "low") continue;
      out.push({
        areaId,
        medicineId: medicine.id,
        medicineName: medicine.name,
        gap: m.accessGap,
        gapLabel: GAP_LABEL[m.accessGap],
        confidence: m.confidence,
        observed: m.reasons,
        areaForAssessment: PROMPT[m.accessGap],
      });
    }
  }
  return out.sort((a, b) => order[a.gap] - order[b.gap] || a.areaId.localeCompare(b.areaId));
}
