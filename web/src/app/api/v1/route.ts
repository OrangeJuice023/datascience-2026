import { withErrors } from "@/lib/api/route";
import { API_VERSION } from "@/lib/api/envelope";

/**
 * GET /api/v1
 *
 * The API surface. Every endpoint returns `{ data, meta }` or
 * `{ error, meta }`; `meta.status` says whether the payload is live, demo,
 * unavailable or not connected.
 */
export const GET = withErrors(async () => {
  return {
    data: {
      service: "sigma-api",
      apiVersion: API_VERSION,
      endpoints: [
        {
          method: "GET",
          path: "/api/v1/health",
          description: "Service availability and configuration flags.",
        },
        {
          method: "GET",
          path: "/api/v1/sources",
          description: "The source catalogue and what each source can answer.",
        },
        {
          method: "GET",
          path: "/api/v1/dengue/observations",
          description: "Raw weekly national dengue observations. Query: from, to, limit.",
        },
        {
          method: "GET",
          path: "/api/v1/dengue/summary",
          description: "Weekly, monthly and yearly aggregates with gaps and completeness. Query: limit.",
        },
        {
          method: "GET",
          path: "/api/v1/dengue/signals",
          description: "Anomaly results (empty until a model is connected) and open-source signal demo data.",
        },
        {
          method: "GET",
          path: "/api/v1/access/metrics",
          description: "Weekly medication-access indicators per area and medicine. Query: medicineId, areaId, limit.",
        },
        {
          method: "GET",
          path: "/api/v1/policy/info",
          description: "Assessment areas, evidence summary, supported diseases and the AI disclosure.",
        },
        {
          method: "POST",
          path: "/api/v1/chat",
          description: "Policy Copilot. Refuses the request when no model provider is configured.",
        },
      ],
    },
    status: "live" as const,
    isSample: false,
  };
});
