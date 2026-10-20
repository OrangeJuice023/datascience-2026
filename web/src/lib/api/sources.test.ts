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
