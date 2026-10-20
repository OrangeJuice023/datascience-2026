import type { NextRequest } from "next/server";
import { dataProvider } from "@/data/opendengue-provider";
import { buildSignals } from "@/lib/api/dengue";
import { ApiError } from "@/lib/api/envelope";
import { assertKnownParams, parseQuery } from "@/lib/api/query";
import { withErrors } from "@/lib/api/route";
import { isValidDisease } from "@/lib/policy-chat/context";

const KNOWN_PARAMS = ["disease", "locationId"] as const;

/**
 * The EARS pipeline is implemented in the Python data track but is not
 * connected to this API. It stays false until a provider is wired in, so the
 * endpoint reports `not_connected` instead of an empty result set that a
 * client could read as "no signal".
 */
const EARS_CONNECTED = false;

/**
 * GET /api/v1/dengue/signals
 *
 * Anomaly results plus the clearly separated open-source signal demo data.
 * While no model is connected, `signals` is empty and `status` is
 * `not_connected`; an empty list never means "no outbreak".
 */
export const GET = withErrors(async (request: NextRequest) => {
  const query = parseQuery(request.nextUrl);
  assertKnownParams(query, KNOWN_PARAMS);

  const disease = query.get("disease") ?? "Dengue";
  if (!isValidDisease(disease)) {
    throw ApiError.notFound(`No signal series is connected for "${disease}".`);
  }
  const locationId = query.get("locationId");

  const [anomalies, demoSignals] = await Promise.all([
    dataProvider.getAnomalyResults("dengue", "ph"),
    dataProvider.getSignals({ disease, ...(locationId ? { locationId } : {}) }),
  ]);

  const data = buildSignals({
    anomalyResults: anomalies.map((a) => ({
      id: a.id,
      geographyId: a.geographyId,
      periodStart: a.periodStart,
      periodEnd: a.periodEnd,
      method: a.model.name,
      value: a.score,
      threshold: a.upperBound,
      alarm: a.status !== "normal",
    })),
    demoSignals,
    earsConnected: EARS_CONNECTED,
  });

  return { data, status: data.status === "live" ? ("live" as const) : ("not_connected" as const), isSample: true };
});
