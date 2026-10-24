import { describe, expect, it } from "vitest";
import type { HealthObservation } from "@/types/data";
import { buildObservations, buildSignals, type DengueSourceDescriptor } from "./dengue";

/**
 * The dengue service layer carries the rules that matter most in this
 * project: a missing week is never zero-filled, a slice never claims to be
 * the whole series, and an empty anomaly list is never reported as "no
 * outbreak".
 */

const DESCRIPTOR: DengueSourceDescriptor = {
  id: "opendengue",
  name: "OpenDengue v1.3",
  version: "1.3",
  extract: "PH national weekly extract",
  filter: "disease=dengue",
  citation: "OpenDengue",
  license: "CC BY 4.0",
  upstreamUrl: null,
  from: "2020-01-05",
  to: "2020-01-19",
  rows: 3,
};

function observation(periodStart: string, value: number, periodEnd?: string): HealthObservation {
  return {
    id: `obs-${periodStart}`,
    diseaseId: "dengue",
    geographyId: "ph",
    geographicLevel: "national",
    periodStart,
    periodEnd: periodEnd ?? periodStart,
    temporalResolution: "weekly",
    metric: "cases",
    caseDefinition: "total",
    value,
    provenance: {
      sourceIds: ["opendengue"],
      method: "ingested",
      recordedAt: "2026-01-01T00:00:00Z",
      isSample: false,
    },
  };
}

/** Three recorded weeks with the middle one missing. */
const SERIES = [observation("2020-01-05", 100), observation("2020-01-19", 300)];

describe("buildObservations", () => {
  it("keeps the record gaps visible instead of zero-filling them", () => {
    const data = buildObservations({ observations: SERIES, descriptor: DESCRIPTOR, limit: 100 });

    expect(data.observations.map((o) => o.value)).toEqual([100, 300]);
    expect(data.series.gaps).toEqual([{ from: "2020-01-12", to: "2020-01-12", missingWeeks: 1 }]);
    expect(data.series.coverage.recordedWeeks).toBe(2);
    expect(data.series.coverage.weeks).toBe(3);
  });

  it("describes the coverage of the whole series, not of the returned slice", () => {
    const data = buildObservations({ observations: SERIES, descriptor: DESCRIPTOR, limit: 1 });

    expect(data.observations).toHaveLength(1);
    expect(data.truncated).toBe(true);
    expect(data.series.coverage.from).toBe(DESCRIPTOR.from);
    expect(data.series.coverage.to).toBe(DESCRIPTOR.to);
  });

  it("filters by the requested date range", () => {
    const data = buildObservations({
      observations: SERIES,
      descriptor: DESCRIPTOR,
      from: "2020-01-12",
      to: "2020-01-26",
      limit: 100,
    });

    expect(data.observations.map((o) => o.periodStart)).toEqual(["2020-01-19"]);
  });

  it("states what the series is and is not", () => {
    const data = buildObservations({ observations: SERIES, descriptor: DESCRIPTOR, limit: 100 });

    expect(data.series.geographicLevel).toBe("national");
    expect(data.series.interpretation).toMatch(/not a forecast/i);
    expect(data.series.limitations.length).toBeGreaterThan(0);
  });
});

describe("buildSignals", () => {
  it("reports not_connected when the EARS results cannot be read", () => {
    const data = buildSignals({ anomalyResults: [], earsConnected: false });

    expect(data.status).toBe("not_connected");
    expect(data.signals).toEqual([]);
    expect(data.engine.status).toBe("not_connected");
    expect(data.reason).toMatch(/not evidence that no outbreak/i);
  });

  it("explains an empty selection without calling it 'no outbreak'", () => {
    const data = buildSignals({ anomalyResults: [], earsConnected: true });

    expect(data.status).toBe("live");
    expect(data.signals).toEqual([]);
    expect(data.reason).toMatch(/no EARS result could be computed/i);
    expect(data.reason).toMatch(/not evidence that no outbreak/i);
  });

  it("reports live only when a model actually returned a result", () => {
    const data = buildSignals({
      anomalyResults: [
        {
          id: "anomaly-1",
          geographyId: "ph",
          periodStart: "2020-01-19",
          periodEnd: "2020-01-25",
          method: "EARS C3",
          value: 4.2,
          threshold: 2,
          alarm: true,
        },
      ],
      earsConnected: true,
    });

    expect(data.status).toBe("live");
    expect(data.signals).toHaveLength(1);
    expect(data.engine.status).toBe("connected");
  });
});
