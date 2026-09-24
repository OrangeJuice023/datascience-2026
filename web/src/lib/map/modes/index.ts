import type { MapModeDefinition, MapModeId } from "../types";
import { ANOMALY_MODE } from "./anomaly";
import { DISEASE_MODE } from "./disease";
import { SIGNALS_MODE } from "./signals";
import { SIMULATION_MODE } from "./simulation";

const ENVIRONMENT_MODE: MapModeDefinition = {
  id: "environment",
  label: "Environment",
  question: "What contextual conditions surround the signals?",
  availability: "planned",
  evidence: "none",
  evidenceLabel: "Environmental covariates",
  extent: "metro",
  filters: [],
  layerToggles: [],
  unavailableReason:
    "Planned: weekly rainfall and temperature covariates (Open-Meteo). No covariate data is connected yet.",
};

const ACCESS_MODE: MapModeDefinition = {
  id: "access",
  label: "Access",
  question: "How reachable are health services?",
  availability: "planned",
  evidence: "none",
  evidenceLabel: "Health-service access",
  extent: "metro",
  filters: [],
  layerToggles: [],
  unavailableReason:
    "Planned: health-facility access layer. No facility dataset has been selected or verified yet.",
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
