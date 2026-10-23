import type { HealthResponse, HealthService } from "@sigma/contracts";
import { SOURCE_CATALOG } from "@/data/source-catalog";

/**
 * Health service layer.
 *
 * The health endpoint reports configuration as booleans only. It never
 * returns an environment value, a URL with a key in it, or a stack trace.
 */

export const HEALTH_VERSION = "0.1.0";

export interface HealthConfig {
  aiProviderConfigured: boolean;
  /** CHAT_DISABLED / CHAT_PUBLIC_DISABLED is set; the copilot refuses requests even with a key. */
  chatSwitchedOff?: boolean;
  mapTilesConfigured: boolean;
}

export function buildHealth(config: HealthConfig): HealthResponse {
  const chatEnabled = config.aiProviderConfigured && !config.chatSwitchedOff;
  const services: HealthService[] = [
    {
      id: "dengue-observations",
      name: "Dengue historical observations",
      status: "ok",
      enabled: true,
      note: "OpenDengue v1.3 national weekly series, served from a validated build-time fixture.",
    },
    {
      id: "anomaly-engine",
      name: "Anomaly detection (EARS)",
      status: "disabled",
      enabled: false,
      note: "The EARS pipeline exists in the Python data track but is not connected to this API, so no anomaly result is served.",
    },
    {
      id: "access-metrics",
      name: "ACCESS medication access metrics",
      status: "ok",
      enabled: true,
      note: "Fully wired prototype running on simulated inventory and search records.",
    },
    {
      id: "policy-copilot",
      name: "Policy Copilot",
      status: chatEnabled ? "ok" : "disabled",
      enabled: chatEnabled,
      note: chatEnabled
        ? "A model provider key is configured server-side."
        : config.chatSwitchedOff
          ? "The copilot is switched off on this deployment, so chat requests are refused rather than answered with a placeholder."
          : "No model provider key is configured, so chat requests are refused rather than answered with a placeholder.",
    },
  ];

  const dataSources = {
    connected: SOURCE_CATALOG.filter((s) => s.status === "connected").length,
    demo: SOURCE_CATALOG.filter((s) => s.status === "demo").length,
    planned: SOURCE_CATALOG.filter((s) => s.status === "planned").length,
  };

  const degraded = services.some((s) => s.status === "degraded");

  return {
    status: degraded ? "degraded" : "ok",
    service: "sigma-api",
    version: HEALTH_VERSION,
    configuration: {
      aiProviderConfigured: config.aiProviderConfigured,
      chatEnabled,
      mapTilesConfigured: config.mapTilesConfigured,
    },
    services,
    dataSources,
  };
}
