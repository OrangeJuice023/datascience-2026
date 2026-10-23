import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO, generateDemoTrajectory, summarizeTrajectory } from "./demo-simulations";

/**
 * Simulate is a deterministic demonstration curve, not a fitted model. These
 * tests pin what it is, so nobody mistakes it for a forecast: same inputs give
 * the same output, it ignores disease and place, and its outputs are bounded
 * index values, not case counts.
 */

describe("generateDemoTrajectory", () => {
  it("is deterministic", () => {
    expect(generateDemoTrajectory(DEFAULT_SCENARIO)).toEqual(generateDemoTrajectory(DEFAULT_SCENARIO));
  });

  it("does not use the disease or the starting place (not location- or disease-aware)", () => {
    const base = generateDemoTrajectory(DEFAULT_SCENARIO);
    expect(generateDemoTrajectory({ ...DEFAULT_SCENARIO, disease: "Measles", startingLocation: "pasig" })).toEqual(base);
  });

  it("returns one point per day from 0 to the horizon, with bounded unitless values", () => {
    const points = generateDemoTrajectory({ ...DEFAULT_SCENARIO, horizon: 30, spatialCoupling: 1, intensity: 1 });
    expect(points).toHaveLength(31);
    expect(points.map((p) => p.day)).toEqual(Array.from({ length: 31 }, (_, i) => i));
    for (const p of points) {
      expect(p.intensity).toBeGreaterThanOrEqual(0.5);
      expect(p.areasReached).toBeLessThanOrEqual(12);
      expect(Number.isFinite(p.intensity)).toBe(true);
    }
  });

  it("handles a zero-day horizon", () => {
    const points = generateDemoTrajectory({ ...DEFAULT_SCENARIO, horizon: 0 });
    expect(points).toHaveLength(1);
    expect(summarizeTrajectory(points).peakDay).toBe(0);
  });
});
