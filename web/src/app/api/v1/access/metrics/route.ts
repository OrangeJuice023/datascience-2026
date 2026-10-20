import type { NextRequest } from "next/server";
import { accessAssessments } from "@/lib/access/assessments";
import { loadAccessBundle } from "@/lib/access/load";
import { buildAccessMetrics } from "@/lib/api/access";
import { assertKnownParams, LIMITS, parseIntOption, parseQuery } from "@/lib/api/query";
import { withErrors } from "@/lib/api/route";
import { dataProvider } from "@/data/opendengue-provider";

const KNOWN_PARAMS = ["medicineId", "areaId", "limit"] as const;

const SOURCE = "Demo inventory (prototype)";
const SOURCE_NOTE =
  "Simulated facility inventory and simulated medicine-search events. A facility listed here has a demo record; that does not establish that the facility is operating, stocked, staffed or clinically accessible.";

/**
 * GET /api/v1/access/metrics
 *
 * Weekly medication-access indicators per area and medicine. The payload
 * states, in its own scope block, what this data can and cannot support, so
 * a client cannot present prototype coverage as real availability.
 */
export const GET = withErrors(async (request: NextRequest) => {
  const query = parseQuery(request.nextUrl);
  assertKnownParams(query, KNOWN_PARAMS);

  const medicineId = query.get("medicineId");
  const areaId = query.get("areaId");

  const limit = parseIntOption(query, "limit", {
    min: 1,
    max: LIMITS.maxAccessMetrics,
    fallback: LIMITS.maxAccessMetrics,
  });

  const [bundle, lgus] = await Promise.all([loadAccessBundle(), dataProvider.getLgus()]);

  const data = buildAccessMetrics({
    bundle,
    assessments: accessAssessments(bundle),
    source: SOURCE,
    sourceNote: SOURCE_NOTE,
    lgus,
    ...(medicineId ? { medicineId } : {}),
    ...(areaId ? { areaId } : {}),
    limit,
  });

  return { data, status: "demo" as const, isSample: true };
});
