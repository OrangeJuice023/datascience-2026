import type { NextRequest } from "next/server";
import { buildSignals } from "@/lib/api/dengue";
import { earsSignals } from "@/lib/api/dengue-signals";
import { ApiError } from "@/lib/api/envelope";
import { assertKnownParams, parseQuery } from "@/lib/api/query";
import { withErrors } from "@/lib/api/route";
import { isValidDisease } from "@/lib/policy-chat/context";
import { readSigmaData } from "@/lib/sigma/summary";

const KNOWN_PARAMS = ["disease", "locationId", "week"] as const;

/**
 * GET /api/v1/dengue/signals
 *
 * EARS C1/C2/C3 results per HDX reporting unit and week, from the committed
 * SIGMA export (ml/ears.py -> ml/export_sigma_web.py). Historical records
 * (2016-2021), not real-time. A week or method with no record had no computable result; an
 * empty list never means "no outbreak". If the export cannot be read the
 * status is `not_connected`, never an empty "live" answer.
 */
export const GET = withErrors(async (request: NextRequest) => {
  const query = parseQuery(request.nextUrl);
  assertKnownParams(query, KNOWN_PARAMS);

  const disease = query.get("disease") ?? "Dengue";
  if (!isValidDisease(disease)) {
    throw ApiError.notFound(`No signal series is connected for "${disease}".`);
  }
  const locationId = query.get("locationId") ?? undefined;
  const week = query.get("week") ?? undefined;

  const sigma = await readSigmaData();

  if (sigma && locationId !== undefined && !sigma.units.some((u) => u.id === locationId)) {
    throw ApiError.badRequest(`Unknown reporting unit "${locationId}".`, { locationId: ["unknown reporting unit"] });
  }
  if (sigma && week !== undefined && !sigma.meta.weeks.includes(week)) {
    throw ApiError.badRequest(`No week starting "${week}" in the series (weeks start on Sunday, 2016-01-10 to 2021-01-03).`, {
      week: ["not a week start in the series"],
    });
  }

  const ears = sigma ? earsSignals(sigma, { unitId: locationId, week }) : { records: [], weeks: [] };
  const data = buildSignals({ anomalyResults: ears.records, earsConnected: sigma !== null });

  return { data, status: data.status === "live" ? ("live" as const) : ("not_connected" as const), isSample: false };
});
