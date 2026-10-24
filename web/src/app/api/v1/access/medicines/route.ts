import type { NextRequest } from "next/server";
import { buildAccessMedicines } from "@/lib/api/access";
import { assertKnownParams, parseQuery } from "@/lib/api/query";
import { withErrors } from "@/lib/api/route";

/**
 * GET /api/v1/access/medicines
 *
 * Dengue medicines with their PNF formulary status and what DOH hospitals
 * paid in 2025 procurement (2026 interim DPRI). Procurement prices, not shelf
 * prices or stock.
 */
export const GET = withErrors(async (request: NextRequest) => {
  assertKnownParams(parseQuery(request.nextUrl), []);
  return { data: buildAccessMedicines(), status: "live" as const, isSample: false };
});
