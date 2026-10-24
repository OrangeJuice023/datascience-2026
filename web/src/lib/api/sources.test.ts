import { describe, expect, it } from "vitest";
import { SOURCE_CATALOG } from "@/data/source-catalog";
import { buildSources, opendengueDescriptor } from "./sources";

/**
 * The source catalogue is the project's honesty layer. A source that is not
 * connected must not be described as if it were, and a source with an unknown
 * coverage window must report `null` rather than a guess.
 */

describe("buildSources", () => {
  it("keeps every catalogue entry, with its own status", () => {
    const sources = buildSources();

    expect(sources).toHaveLength(SOURCE_CATALOG.length);
    for (const source of sources) {
      expect(source.id).toBeTruthy();
      expect(source.name).toBeTruthy();
      expect(["connected", "demo", "planned"]).toContain(source.status);
      expect(source.scope.length).toBeGreaterThan(0);
    }
  });

  it("never reports a planned source as connected", () => {
    const sources = buildSources();
    const planned = SOURCE_CATALOG.filter((entry) => entry.status === "planned");

    for (const entry of planned) {
      const source = sources.find((s) => s.id === entry.sourceId);
      expect(source?.status).toBe("planned");
    }
  });

  it("reports an unknown coverage window as null rather than a guess", () => {
    const sources = buildSources();
    const planned = sources.filter((s) => s.status === "planned");

    for (const source of planned) {
      expect(source.coverage.from).toBeNull();
      expect(source.coverage.to).toBeNull();
    }
  });

  it("states the OpenDengue coverage window it actually has", () => {
    const sources = buildSources();
    const opendengue = sources.find((s) => s.id === "opendengue");

    expect(opendengue?.status).toBe("connected");
    expect(opendengue?.coverage.from).toBe("2012-12-30");
    expect(opendengue?.coverage.to).toBe("2023-11-25");
    expect(opendengue?.coverage.geographicLevel).toBe("national");
  });
});

describe("opendengueDescriptor", () => {
  it("describes the series that is actually committed to the repository", () => {
    const descriptor = opendengueDescriptor();

    expect(descriptor.id).toBe("opendengue");
    expect(descriptor.from < descriptor.to).toBe(true);
    expect(descriptor.rows).toBeGreaterThan(0);
    expect(descriptor.license).toBeTruthy();
  });
});

describe("source catalogue contents", () => {
  it("never lists GADM, whose licence forbids redistribution", () => {
    const ids = buildSources().map((s) => s.id.toLowerCase());
    expect(ids.some((id) => id.includes("gadm"))).toBe(false);
    expect(JSON.stringify(buildSources())).not.toMatch(/gadm/i);
  });

  it("lists the dengue data and boundaries the map actually uses, with licence and attribution", () => {
    const byId = new Map(buildSources().map((s) => [s.id, s]));
    expect(byId.get("hdx-doh-dengue")).toMatchObject({ status: "connected", licence: "CC BY" });
    expect(byId.get("hdx-doh-dengue")?.coverage).toMatchObject({ from: "2016-01-10", to: "2021-01-03" });
    expect(byId.get("geoboundaries")).toMatchObject({ status: "connected", licence: "CC BY 3.0 IGO" });
    expect(byId.get("cod-ab-phl")).toMatchObject({ status: "connected", licence: "CC BY-IGO" });
    for (const source of buildSources()) expect(source.attribution.length).toBeGreaterThan(0);
  });

  it("lists the ACCESS facility and price sources with the licence and credit line recorded with the data", async () => {
    const { ACCESS_REFERENCE } = await import("@/lib/access/reference");
    const byId = new Map(buildSources().map((s) => [s.id, s]));
    const catalogued = new Map(SOURCE_CATALOG.map((s) => [s.sourceId, s]));
    for (const id of ["hotosm-phl-health-facilities", "doh-dpri-dashboard"]) {
      const recorded = ACCESS_REFERENCE.meta.sources.find((s) => s.id === id);
      expect(recorded, id).toBeDefined();
      expect(byId.get(id)).toMatchObject({ status: "connected", evidence: "context", attribution: recorded?.attribution });
      expect(recorded?.license.startsWith(byId.get(id)?.licence ?? "missing"), id).toBe(true);
      expect(catalogued.get(id)?.url, id).toBe(recorded?.url);
    }
  });

  it("lists no simulated source: every entry is connected or planned", () => {
    expect(buildSources().filter((s) => s.status !== "connected" && s.status !== "planned")).toEqual([]);
  });

  it("gives the copilot the same sources and statuses as the API", async () => {
    const { buildPolicyChatContext } = await import("@/lib/policy-chat/context");
    const context = await buildPolicyChatContext("Dengue", "quezon-city");
    expect(context.sources.map((s) => [s.name, s.status])).toEqual(buildSources().map((s) => [s.name, s.status]));
  });
});
