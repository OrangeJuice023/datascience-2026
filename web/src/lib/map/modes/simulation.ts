import { generateDemoTrajectory } from "@/data/demo-simulations";
import { nearestByDistance } from "../geo";
import { SCENARIO_HEX, hexToRgba } from "../palette";
import type { MapDataBundle, MapFeature, MapLink, MapModeDefinition, PreparedMode } from "../types";

/** Same reach rule as the Simulate page: areasReached counts the origin. */
const MAX_NEIGHBORS = 8;

function prepare(bundle: MapDataBundle): PreparedMode {
  const scenario = bundle.scenario;
  const trajectory = generateDemoTrajectory(scenario);
  const origin = bundle.lgus.find((lgu) => lgu.id === scenario.startingLocation);
  const ranked = nearestByDistance(bundle.lgus, scenario.startingLocation, MAX_NEIGHBORS);
  const maxIntensity = Math.max(...trajectory.map((p) => p.intensity), 1);

  // First scenario day on which each neighbor is counted as reached.
  const reachedOnDay = ranked.map(
    (_, rank) => trajectory.find((p) => p.areasReached - 1 > rank)?.day ?? null,
  );

  return {
    timeline: {
      slices: trajectory.map((p) => ({
        key: String(p.day),
        label: `Scenario day ${p.day}`,
        shortLabel: `Day ${p.day}`,
        value: p.intensity,
        gapBefore: false,
      })),
      trackLabel: "Modeled intensity per scenario day (demo)",
      interpretation: `Map shows areas reached by the selected day, from ${origin?.name ?? "the origin"}, under default assumptions.`,
      formatValue: (v) => `${v.toFixed(2)}x intensity`,
    },
    legend: {
      title: "Scenario reach",
      metric: "Areas reached under assumed spatial coupling",
      classification: "categorical",
      classes: [
        { label: "Scenario origin", color: SCENARIO_HEX.origin },
        { label: "Reached in scenario", color: SCENARIO_HEX.reached },
      ],
      height: { label: "Column height (3D): modeled intensity at origin" },
      note: "Illustrative scenario from a demonstration model. Not a forecast.",
    },
    frameAt(index) {
      const point = trajectory[Math.min(index, trajectory.length - 1)];
      if (!origin || !point) return { features: [], links: [] };

      const features: MapFeature[] = [
        {
          id: origin.id,
          name: origin.name,
          position: [origin.longitude, origin.latitude],
          color: hexToRgba(SCENARIO_HEX.origin, 245),
          radius: 11,
          elevation: point.intensity / maxIntensity,
          classLabel: "Scenario origin",
          rank: Infinity,
          rows: [
            { label: "Role", value: "Scenario origin" },
            { label: "Modeled intensity", value: `${point.intensity.toFixed(2)}x` },
            { label: "Areas reached", value: String(point.areasReached) },
            { label: "Scenario day", value: String(point.day) },
          ],
        },
      ];
      const links: MapLink[] = [];

      ranked.forEach(({ item, distanceKm }, rank) => {
        const day = reachedOnDay[rank];
        if (day === null || day > point.day) return;
        features.push({
          id: item.id,
          name: item.name,
          position: [item.longitude, item.latitude],
          color: hexToRgba(SCENARIO_HEX.reached, 235),
          radius: 8,
          elevation: 0,
          classLabel: "Reached in scenario",
          rank: -day,
          rows: [
            { label: "Role", value: "Reached in scenario" },
            { label: "Reached on", value: `Day ${day}` },
            { label: "Distance from origin", value: `${distanceKm.toFixed(1)} km` },
          ],
        });
        links.push({
          id: `${origin.id}->${item.id}`,
          from: [origin.longitude, origin.latitude],
          to: [item.longitude, item.latitude],
          color: hexToRgba(SCENARIO_HEX.link, 170),
        });
      });

      return { features, links };
    },
  };
}

export const SIMULATION_MODE: MapModeDefinition = {
  id: "simulation",
  label: "Simulation",
  question: "What could happen under different assumptions?",
  availability: "demo",
  evidence: "scenario",
  evidenceLabel: "Scenario output (demo model)",
  extent: "metro",
  filters: [],
  layerToggles: ["links", "columns"],
  defaultToggles: { links: true },
  prepare,
};
