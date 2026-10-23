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
import { ACCESS_MODE } from "./access";
import { ANOMALY_MODE } from "./anomaly";
import { DISEASE_MODE } from "./disease";
import { ENVIRONMENT_MODE } from "./environment";
import { SIGMA_MODE } from "./sigma";
import { SIGNALS_MODE } from "./signals";
import { SIMULATION_MODE } from "./simulation";

/** Display order follows TRACE → ANALYZE → SIMULATE. */
export const MAP_MODES: MapModeDefinition[] = [
  SIGNALS_MODE,
  DISEASE_MODE,
  ANOMALY_MODE,
  SIGMA_MODE,
  ENVIRONMENT_MODE,
  ACCESS_MODE,
  SIMULATION_MODE,
];

export function getMapMode(id: MapModeId): MapModeDefinition {
  return MAP_MODES.find((mode) => mode.id === id) ?? SIGNALS_MODE;
}
