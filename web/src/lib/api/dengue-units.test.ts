import { NextRequest } from "next/server";
import type { DengueUnitsData } from "@sigma/contracts";
import { describe, expect, it } from "vitest";
import { GET as unitsGet } from "@/app/api/v1/dengue/units/route";
import { ACCESS_REFERENCE } from "@/lib/access/reference";
import { readSigmaData } from "@/lib/sigma/summary";
import { buildDengueUnits } from "./dengue-units";

/**
 * GET /api/v1/dengue/units over the committed SIGMA export. What matters:
 * every unit is served, an unknown unit is a 400, and a count that could not
 * be computed is null rather than zero.
 */

const request = (q = "") => new NextRequest(`http://localhost/api/v1/dengue/units${q}`);

async function load(): Promise<DengueUnitsData> {
  const data = await readSigmaData();
  if (!data) throw new Error("SIGMA export missing");
  return buildDengueUnits(data);
}

describe("GET /api/v1/dengue/units", () => {
  it("serves all 126 reporting units as live, non-sample data", async () => {
    const response = await unitsGet(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.meta.status).toBe("live");
    expect(body.meta.isSample).toBe(false);
    expect(body.data.units).toHaveLength(126);
    expect(body.data.scope.units).toBe(126);
    expect(body.data.scope.period).toEqual({
      from: "2016-01-10",
      to: "2021-01-03",
      weeks: 261,
      epiYears: [2016, 2017, 2018, 2019, 2020],
    });
  });

  it("narrows to one unit, and rejects an unknown unit or parameter", async () => {
    const one = await (await unitsGet(request("?unitId=quezon-city"))).json();
    expect(one.data.units.map((u: { id: string }) => u.id)).toEqual(["quezon-city"]);
    expect(one.data.scope.units).toBe(1);

    const unknown = await unitsGet(request("?unitId=atlantis"));
    expect(unknown.status).toBe(400);
    const body = await unknown.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.details).toEqual({ unitId: ["unknown reporting unit"] });

    expect((await unitsGet(request("?unitId="))).status).toBe(400);
    expect((await unitsGet(request("?province=rizal"))).status).toBe(400);
  });

  it("reports a year with no usable week as null cases, never zero", async () => {
    const { units } = await load();
    const davao = units.find((u) => u.id === "davao-occidental")?.years.find((y) => y.year === 2016);
    expect(davao).toMatchObject({ usableWeeks: 0, cases: null, earsWeeks: null, dohWeeks: null });
    for (const unit of units) {
      for (const year of unit.years) {
        expect(year.cases === null).toBe(year.usableWeeks === 0);
        expect(year.usableWeeks).toBeLessThanOrEqual(year.weeks);
      }
    }
  });

  it("has no DOH-threshold count before 2019, when thresholds need three prior years", async () => {
    const { units } = await load();
    for (const unit of units) {
      for (const year of unit.years) {
        if (year.year < 2019) {
          expect(year.dohWeeks).toBeNull();
          expect(year.dohEvaluatedWeeks).toBe(0);
        }
        if (year.dohWeeks !== null) expect(year.dohWeeks).toBeLessThanOrEqual(year.dohEvaluatedWeeks);
        if (year.earsWeeks !== null) expect(year.earsWeeks).toBeLessThanOrEqual(year.earsEvaluatedWeeks);
        expect(year.earsEvaluatedWeeks).toBeLessThanOrEqual(year.usableWeeks);
      }
    }
  });

  it("agrees with the case counts ACCESS reports for the same units", async () => {
    const { units } = await load();
    const byId = new Map(units.map((u) => [u.id, u]));
    for (const accessUnit of ACCESS_REFERENCE.units) {
      for (const row of accessUnit.dengue ?? []) {
        const year = byId.get(accessUnit.id)?.years.find((y) => y.year === row.year);
        expect(year, `${accessUnit.id} ${row.year}`).toBeDefined();
        expect(year?.usableWeeks).toBe(row.usableWeeks);
        expect(year?.weeks).toBe(row.weeks);
        if (row.usableWeeks > 0) expect(year?.cases).toBe(row.reportedCases);
      }
    }
  });
});
