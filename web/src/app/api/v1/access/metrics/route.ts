import type { NextRequest } from "next/server";
import { buildRetiredAccessMetrics } from "@/lib/api/access";
import { assertKnownParams, parseQuery } from "@/lib/api/query";
import { withErrors } from "@/lib/api/route";

const KNOWN_PARAMS = ["medicineId", "areaId", "limit"] as const;

/**
 * GET /api/v1/access/metrics
 *
 * Retired. It served weekly demo inventory and search events, which have no
 * real source, so it answers `not_connected` with empty lists. Real ACCESS
 * data is at /access/units and /access/medicines.
 */
export const GET = withErrors(async (request: NextRequest) => {
  assertKnownParams(parseQuery(request.nextUrl), KNOWN_PARAMS);
  return { data: buildRetiredAccessMetrics(), status: "not_connected" as const, isSample: false };
});
