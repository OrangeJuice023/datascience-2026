import type { NextRequest } from "next/server";
import { buildDengueUnits } from "@/lib/api/dengue-units";
import { ApiError } from "@/lib/api/envelope";
import { assertKnownParams, parseQuery } from "@/lib/api/query";
import { withErrors } from "@/lib/api/route";
import { readSigmaData } from "@/lib/sigma/summary";

const KNOWN_PARAMS = ["unitId"] as const;

/**
 * GET /api/v1/dengue/units
 *
 * Per HDX dengue reporting unit and epi year (2016-2020): reported cases over
 * usable weeks, EARS alarm weeks and weeks above a DOH threshold, from the
 * committed SIGMA export. Historical records, not real-time. Missing and
 * suspect weeks are no data, never zero; a count that could not be computed
 * is null.
 */
export const GET = withErrors(async (request: NextRequest) => {
  const query = parseQuery(request.nextUrl);
  assertKnownParams(query, KNOWN_PARAMS);

  const data = await readSigmaData();
  if (!data) {
    throw new ApiError("unavailable", 503, "The reporting-unit dengue series is not available right now.");
  }

  const unitId = query.get("unitId") ?? undefined;
  if (unitId !== undefined && !data.units.some((u) => u.id === unitId)) {
    throw ApiError.badRequest(`Unknown reporting unit "${unitId}".`, { unitId: ["unknown reporting unit"] });
  }

  return { data: buildDengueUnits(data, { unitId }), status: "live" as const, isSample: false };
});
