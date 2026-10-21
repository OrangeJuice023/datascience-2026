import type { NextRequest } from "next/server";
import { dataProvider } from "@/data/opendengue-provider";
import { buildObservations } from "@/lib/api/dengue";
import { ApiError } from "@/lib/api/envelope";
import { assertKnownParams, LIMITS, parseDateOption, parseIntOption, parseQuery } from "@/lib/api/query";
import { withErrors } from "@/lib/api/route";
import { opendengueDescriptor } from "@/lib/api/sources";

const KNOWN_PARAMS = ["disease", "from", "to", "limit"] as const;

/**
 * GET /api/v1/dengue/observations
 *
 * Raw weekly observation records from the national OpenDengue series.
 * Missing weeks are absent from the source, so they are absent here: the
 * response is never zero-filled and never interpolated.
 */
export const GET = withErrors(async (request: NextRequest) => {
  const query = parseQuery(request.nextUrl);
  assertKnownParams(query, KNOWN_PARAMS);

  const disease = query.get("disease") ?? "dengue";
  if (disease !== "dengue") {
    throw ApiError.notFound(`No observation series is connected for "${disease}".`);
  }

  const from = parseDateOption(query, "from");
  const to = parseDateOption(query, "to");
  if (from && to && from.value > to.value) {
    throw ApiError.badRequest('"from" must not be later than "to".', {
      from: ["later than to"],
    });
  }

  const limit = parseIntOption(query, "limit", {
    min: 1,
    max: LIMITS.maxObservations,
    fallback: LIMITS.maxObservations,
  });

  const observations = await dataProvider.getHealthObservations("dengue", "ph");
  if (observations.length === 0) {
    throw new ApiError(
      "unavailable",
      503,
      "The national dengue observation series is not available right now.",
    );
  }

  const data = buildObservations({
    observations,
    descriptor: opendengueDescriptor(),
    from: from?.value,
    to: to?.value,
    limit,
  });

  return { data, status: "live" as const, isSample: false };
});
