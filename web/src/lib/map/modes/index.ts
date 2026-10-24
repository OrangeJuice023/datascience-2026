import type { MapModeDefinition, MapModeId, ModeEvidence } from "../types";
import type { EvidenceKind } from "@/components/ui/evidence-badge";

/** Collapses mode evidence into the four categories the UI badges. */
export const EVIDENCE_KIND: Record<ModeEvidence, EvidenceKind> = {
  health_observations: "formal",
  public_health_signals: "signal",
  model_output: "model",
  scenario: "model",
  context: "context",
};
import { ENVIRONMENT_MODE } from "./environment";
import { CASES_MODE, DOH_MODE, EARS_MODE } from "./sigma";

/**
 * Explore's four views: reported cases, the EARS signal and the DOH
 * threshold (all SIGMA results on the 126 reporting units), then weekly
 * city weather as context. ACCESS has its own page under Analyze.
 */
export const MAP_MODES: MapModeDefinition[] = [CASES_MODE, EARS_MODE, DOH_MODE, ENVIRONMENT_MODE];

export function getMapMode(id: MapModeId): MapModeDefinition {
  return MAP_MODES.find((mode) => mode.id === id) ?? EARS_MODE;
}
