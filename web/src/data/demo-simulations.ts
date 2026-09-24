import type { SimulationResultPoint, SimulationInputs } from "@/types";

export const DEFAULT_SCENARIO: SimulationInputs = {
  disease: "Dengue",
  startingLocation: "quezon-city",
  horizon: 14,
  spatialCoupling: 0.4,
  persistence: 0.5,
  interventionTiming: 8,
  intensity: 0.5,
};

/**
 * DEMONSTRATION MODEL — a simple deterministic curve used only to make the
 * Simulate screen interactive. It is not a validated epidemiological model
 * and should never be presented as a forecast.
 */
export function generateDemoTrajectory(
  scenario: SimulationInputs,
): SimulationResultPoint[] {
  const {
    horizon,
    spatialCoupling,
    persistence,
    interventionTiming,
    intensity,
  } = scenario;

  const points: SimulationResultPoint[] = [];
  let level = 1 + intensity * 2;

  for (let day = 0; day <= horizon; day++) {
    const growth = 1 + (0.18 + spatialCoupling * 0.12) * (1 - persistence * 0.3);
    const decay = day >= interventionTiming ? 0.82 - spatialCoupling * 0.1 : 1;
    level = day === 0 ? level : level * growth * decay;
    level = Math.max(0.5, level);

    const areasReached = Math.min(
      12,
      Math.round(1 + day * (0.35 + spatialCoupling * 0.9)),
    );

    points.push({
      day,
      intensity: Math.round(level * 100) / 100,
      areasReached,
    });
  }

  return points;
}

export function summarizeTrajectory(points: SimulationResultPoint[]) {
  const max = points.reduce((a, b) => (b.intensity > a.intensity ? b : a));
  const areasReached = points[points.length - 1]?.areasReached ?? 0;
  return {
    maxIntensity: max.intensity,
    peakDay: max.day,
    areasReached,
  };
}
