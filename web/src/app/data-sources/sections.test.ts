import { describe, expect, it } from "vitest";
import { SOURCE_CATALOG, type SourceCatalogEntry } from "@/data/source-catalog";
import { SOURCE_GROUPS, SOURCE_USAGE, groupCatalog } from "./sections";

/**
 * The Data Sources page must list every catalogue entry exactly once, and
 * must never show a demo or planned source among the connected ones.
 */

describe("groupCatalog", () => {
  it("places every connected source in exactly one topic section", () => {
    const { groups, ungrouped } = groupCatalog(SOURCE_CATALOG);
    const placed = groups.flatMap((g) => g.entries.map((e) => e.sourceId));

    expect(ungrouped).toEqual([]);
    expect(new Set(placed).size).toBe(placed.length);
    expect(placed.sort()).toEqual(
      SOURCE_CATALOG.filter((s) => s.status === "connected")
        .map((s) => s.sourceId)
        .sort(),
    );
  });

  it("lists demo and planned sources only under Not connected", () => {
    const { groups, notConnected } = groupCatalog(SOURCE_CATALOG);

    for (const { entries } of groups) {
      for (const entry of entries) expect(entry.status).toBe("connected");
    }
    expect(notConnected.map((s) => s.sourceId)).toEqual(
      SOURCE_CATALOG.filter((s) => s.status !== "connected").map((s) => s.sourceId),
    );
    expect(notConnected.map((s) => s.sourceId)).toEqual(
      expect.arrayContaining(["gdelt-doc", "ph-news-rss", "doh-weekly", "ritm-surveillance"]),
    );
  });

  it("moves a source out of its section if the catalogue stops calling it connected", () => {
    const demoted: SourceCatalogEntry[] = SOURCE_CATALOG.map((s) =>
      s.sourceId === "open-meteo" ? { ...s, status: "planned" } : s,
    );
    const { groups, notConnected } = groupCatalog(demoted);

    const environment = groups.find((g) => g.group.id === "environment");
    expect(environment?.entries.map((e) => e.sourceId)).toEqual(["project-cchain"]);
    expect(notConnected.some((s) => s.sourceId === "open-meteo")).toBe(true);
  });

  it("only names sources that exist in the catalogue", () => {
    const ids = new Set(SOURCE_CATALOG.map((s) => s.sourceId));
    for (const group of SOURCE_GROUPS) {
      for (const id of group.sourceIds) expect(ids.has(id), id).toBe(true);
    }
    for (const id of Object.keys(SOURCE_USAGE)) expect(ids.has(id), id).toBe(true);
  });

  it("says where every connected source is used, and calls only the basemap live", () => {
    for (const source of SOURCE_CATALOG.filter((s) => s.status === "connected")) {
      const usage = SOURCE_USAGE[source.sourceId];
      expect(usage, source.sourceId).toBeDefined();
      expect(usage.uses.length > 0 || Boolean(usage.buildOnly), source.sourceId).toBe(true);
    }
    const live = Object.entries(SOURCE_USAGE)
      .filter(([, usage]) => usage.refresh === "live")
      .map(([id]) => id);
    expect(live).toEqual(["openstreetmap"]);
  });
});
