import { describe, expect, it } from "vitest";
import type { Signal } from "@/types";
import { DEMO_LGUS } from "@/data/demo-lgus";
import { getNeighborSummaries, neighborKey } from "./neighbors";

/**
 * Neighbour context. A neighbour summary must describe the disease that was
 * asked about, in the same reporting window, and must say "no data" when
 * there is nothing to say rather than "normal, 0%".
 */

function signal(partial: Partial<Signal> & Pick<Signal, "disease" | "locationId" | "date" | "status">): Signal {
  return {
    id: `${partial.disease}-${partial.locationId}-${partial.date}`,
    locationName: partial.locationId,
    signalLevel: 1,
    sourceCount: 1,
    confidence: "low",
    changePercent: 10,
    ...partial,
  };
}

describe("getNeighborSummaries", () => {
  it("ignores signals for other diseases", () => {
    // Pasig's only signals in the fixture are dengue; a measles question must not see them.
    const signals = [
      signal({ disease: "Dengue", locationId: "pasig", date: "2026-09-17", status: "elevated", changePercent: 58 }),
      signal({ disease: "Measles", locationId: "manila", date: "2026-09-10", status: "watch" }),
    ];
    const result = getNeighborSummaries("mandaluyong", "Measles", { count: DEMO_LGUS.length, signals });
    const pasig = result.find((n) => n.locationId === "pasig");
    expect(pasig).toMatchObject({ disease: "Measles", status: null, changePercent: null, date: null });
    expect(result.find((n) => n.locationId === "manila")?.status).toBe("watch");
  });

  it("reports a missing neighbour as no data, never normal or 0%", () => {
    const result = getNeighborSummaries("quezon-city", "Measles", { signals: [] });
    expect(result.length).toBeGreaterThan(0);
    for (const n of result) {
      expect(n.status).toBeNull();
      expect(n.changePercent).toBeNull();
    }
  });

  it("drops signals outside the reporting window", () => {
    const signals = [
      signal({ disease: "Dengue", locationId: "manila", date: "2026-06-01", status: "elevated" }),
      signal({ disease: "Dengue", locationId: "makati", date: "2026-09-15", status: "normal", changePercent: 3 }),
    ];
    const result = getNeighborSummaries("pasay", "Dengue", { count: DEMO_LGUS.length, signals, asOf: "2026-09-18" });
    expect(result.find((n) => n.locationId === "manila")?.status).toBeNull();
    expect(result.find((n) => n.locationId === "makati")).toMatchObject({ status: "normal", changePercent: 3 });
  });

  it("ignores signals dated after the as-of date", () => {
    const signals = [signal({ disease: "Dengue", locationId: "manila", date: "2026-09-20", status: "elevated" })];
    const result = getNeighborSummaries("pasay", "Dengue", { count: DEMO_LGUS.length, signals, asOf: "2026-09-10" });
    expect(result.find((n) => n.locationId === "manila")?.status).toBeNull();
  });

  it("uses the latest qualifying signal, not the most severe", () => {
    const signals = [
      signal({ disease: "Dengue", locationId: "manila", date: "2026-09-01", status: "elevated" }),
      signal({ disease: "Dengue", locationId: "manila", date: "2026-09-15", status: "watch" }),
    ];
    const result = getNeighborSummaries("pasay", "Dengue", { count: DEMO_LGUS.length, signals });
    expect(result.find((n) => n.locationId === "manila")).toMatchObject({ status: "watch", date: "2026-09-15" });
  });

  it("returns nothing for an unknown location", () => {
    expect(getNeighborSummaries("nowhere", "Dengue")).toEqual([]);
  });

  it("never lists the location as its own neighbour and caps at the available LGUs", () => {
    const result = getNeighborSummaries("antipolo", "Dengue", { count: 100 });
    expect(result).toHaveLength(DEMO_LGUS.length - 1);
    expect(result.some((n) => n.locationId === "antipolo")).toBe(false);
  });

  it("keys map bundle entries by disease and location", () => {
    expect(neighborKey("Dengue", "pasig")).not.toBe(neighborKey("Measles", "pasig"));
  });
});
