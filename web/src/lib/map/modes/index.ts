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
import { SIGNALS_MODE } from "./signals";
import { SIMULATION_MODE } from "./simulation";

const ENVIRONMENT_MODE: MapModeDefinition = {
  id: "environment",
  label: "Environment",
  question: "What contextual conditions surround the signals?",
  availability: "planned",
  evidence: "context",
  evidenceLabel: "Environmental covariates",
  extent: "metro",
  filters: [],
  layerToggles: [],
  unavailableReason:
    "Planned: weekly rainfall and temperature covariates (Open-Meteo). No covariate data is connected yet.",
};

/** Display order follows TRACE → ANALYZE → SIMULATE. */
export const MAP_MODES: MapModeDefinition[] = [
  SIGNALS_MODE,
  DISEASE_MODE,
  ANOMALY_MODE,
  ENVIRONMENT_MODE,
  ACCESS_MODE,
  SIMULATION_MODE,
];

export function getMapMode(id: MapModeId): MapModeDefinition {
  return MAP_MODES.find((mode) => mode.id === id) ?? SIGNALS_MODE;
}
