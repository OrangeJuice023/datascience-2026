import { withErrors } from "@/lib/api/route";
import { API_VERSION } from "@/lib/api/envelope";
import { API_ENDPOINTS } from "@/lib/api/registry";

/**
 * GET /api/v1
 *
 * The API surface. Every endpoint returns `{ data, meta }` or
 * `{ error, meta }`; `meta.status` says whether the payload is live, demo,
 * unavailable or not connected.
 *
 * The list below comes from the same registry that renders the
 * `/documentation` page, so the machine-readable index and the human-readable
 * reference cannot disagree about what the API serves.
 */
export const GET = withErrors(async () => {
  return {
    data: {
      service: "sigma-api",
      apiVersion: API_VERSION,
      endpoints: API_ENDPOINTS.filter((endpoint) => endpoint.listedInIndex).map((endpoint) => ({
        method: endpoint.method,
        path: `/api/v1${endpoint.path}`,
        description: endpoint.summary,
      })),
    },
    status: "live" as const,
    isSample: false,
  };
});
