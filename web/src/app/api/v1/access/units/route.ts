import type { NextRequest } from "next/server";
import { buildAccessUnits } from "@/lib/api/access";
import { ApiError } from "@/lib/api/envelope";
import { assertKnownParams, parseQuery } from "@/lib/api/query";
import { withErrors } from "@/lib/api/route";
import { accessUnit } from "@/lib/access/reference";

const KNOWN_PARAMS = ["unitId"] as const;

/**
 * GET /api/v1/access/units
 *
 * Per reporting unit: hospitals, clinics, pharmacies and laboratories mapped
 * in OpenStreetMap, their density per 100 km², and reported dengue cases per
 * year. Medicine availability, search demand and population are always null:
 * no source provides them, and they are never estimated.
 */
export const GET = withErrors(async (request: NextRequest) => {
  const query = parseQuery(request.nextUrl);
  assertKnownParams(query, KNOWN_PARAMS);
  const unitId = query.get("unitId") ?? undefined;
  if (unitId && !accessUnit(unitId)) {
    throw ApiError.badRequest(`Unknown reporting unit "${unitId}".`, { unitId: ["unknown reporting unit"] });
  }
  return { data: buildAccessUnits({ unitId }), status: "live" as const, isSample: false };
});
