import type { NextRequest } from "next/server";
import { dataProvider } from "@/data/opendengue-provider";
import { buildSummary } from "@/lib/api/dengue";
import { ApiError } from "@/lib/api/envelope";
import { assertKnownParams, LIMITS, parseIntOption, parseQuery } from "@/lib/api/query";
import { withErrors } from "@/lib/api/route";
import { opendengueDescriptor } from "@/lib/api/sources";

const KNOWN_PARAMS = ["limit"] as const;

/**
 * GET /api/v1/dengue/summary
 *
 * Weekly, monthly and yearly aggregates of the national series. Weekly,
 * monthly and yearly rows are separate reporting streams and are never
 * summed into one another. A missing week appears as `value: null` and a
 * gap is listed in `series.gaps` — it is never zero-filled.
 */
export const GET = withErrors(async (request: NextRequest) => {
  const query = parseQuery(request.nextUrl);
  assertKnownParams(query, KNOWN_PARAMS);

  const limit = parseIntOption(query, "limit", {
    min: 1,
    max: LIMITS.maxSummaryPoints,
    fallback: LIMITS.maxSummaryPoints,
  });

  const observations = await dataProvider.getHealthObservations("dengue", "ph");
  if (observations.length === 0) {
    throw new ApiError(
      "unavailable",
      503,
      "The national dengue observation series is not available right now.",
    );
  }

  const data = buildSummary({
    observations,
    descriptor: opendengueDescriptor(),
    limit,
  });

  return { data, status: "live" as const, isSample: false };
});
