import { describe, expect, it } from "vitest";
import { buildHealth } from "./health";

/**
 * The health endpoint is the one a mobile client polls before it shows
 * anything. It reports configuration as booleans, so no environment value,
 * key or URL can leak through it.
 */

describe("buildHealth", () => {
  it("reports configuration as flags only", () => {
    const health = buildHealth({ aiProviderConfigured: true, mapTilesConfigured: false });

    expect(health.configuration).toEqual({ aiProviderConfigured: true, chatEnabled: true, mapTilesConfigured: false });
    expect(JSON.stringify(health)).not.toMatch(/GROQ|sk-|API_KEY/i);
  });

  it("reports the EARS engine as served from the committed export, historical only", () => {
    const health = buildHealth({ aiProviderConfigured: false, mapTilesConfigured: false });
    const engine = health.services.find((s) => s.id === "anomaly-engine");

    expect(engine?.enabled).toBe(true);
    expect(engine?.status).toBe("ok");
    expect(engine?.note).toMatch(/not real-time/i);
  });

  it("marks the retired stock/search metrics disabled instead of ok", () => {
    const health = buildHealth({ aiProviderConfigured: false, mapTilesConfigured: false });
    const metrics = health.services.find((s) => s.id === "access-metrics");

    expect(metrics?.enabled).toBe(false);
    expect(metrics?.note).toMatch(/no public source/i);
  });

  it("disables the copilot when no provider is configured, and says why", () => {
    const health = buildHealth({ aiProviderConfigured: false, mapTilesConfigured: true });
    const copilot = health.services.find((s) => s.id === "policy-copilot");

    expect(copilot?.enabled).toBe(false);
    expect(copilot?.status).toBe("disabled");
    expect(copilot?.note).toMatch(/refused rather than answered with a placeholder/i);
  });

  it("enables the copilot when a provider is configured", () => {
    const health = buildHealth({ aiProviderConfigured: true, mapTilesConfigured: true });
    const copilot = health.services.find((s) => s.id === "policy-copilot");

    expect(copilot?.enabled).toBe(true);
    expect(copilot?.status).toBe("ok");
  });

  it("counts the source catalogue by status", () => {
    const health = buildHealth({ aiProviderConfigured: false, mapTilesConfigured: false });

    expect(health.dataSources.connected + health.dataSources.demo + health.dataSources.planned).toBeGreaterThan(0);
    expect(health.status).toBe("ok");
  });
});
