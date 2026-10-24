import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SigmaData } from "@/lib/sigma/data";
import { getAllPolicyEvidence } from "@/data/policy-evidence";
import { accessUnit } from "@/lib/access/reference";
import { buildEvidencePack, citedItems, foreignEvidenceIds, labItemsForUnit, normalizeHyphens } from "./evidence";
import { PROMPT_BUDGET_CHARS } from "@/lib/api/chat";
import { buildAnalyzePrompt, NO_EVIDENCE_REPLY } from "./prompt";

/**
 * SIGI's evidence pack, on the real committed data. What matters: each place
 * gets its own evidence and never another LGU's, missing weeks are never
 * counted as cases, and only ids the model was given can become citations.
 */
const SIGMA = JSON.parse(
  readFileSync(join(process.cwd(), "public", "data", "sigma", "hdx-dengue-sigma.json"), "utf8"),
) as SigmaData;

function pack(unitId: string) {
  return buildEvidencePack({
    unitId,
    unitName: unitId,
    sigma: SIGMA,
    national: null,
    accessUnit: accessUnit(unitId),
    policyRecords: getAllPolicyEvidence(),
  });
}

describe("the evidence pack", () => {
  it("gives Quezon City its own Lab, ACCESS and policy evidence, plus national and method items", () => {
    const ids = pack("quezon-city").items.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "lab-quezon-city-2016",
        "lab-quezon-city-2019",
        "lab-quezon-city-2020",
        "access-quezon-city-facilities",
        "access-medicines-dpri",
        "pe-qc-annual-report-2025",
        "pe-national-lgc-1991",
        "method-ears",
        "method-doh",
      ]),
    );
  });

  it("never gives one city another city's local policy records", () => {
    const qc = pack("quezon-city").items.map((i) => i.id);
    expect(qc.some((id) => id.startsWith("pe-pasig"))).toBe(false);
    const pasig = pack("pasig-city").items.map((i) => i.id);
    expect(pasig).toContain("pe-pasig-tf-2025");
    expect(pasig.some((id) => id.startsWith("pe-qc"))).toBe(false);
    // A unit with no verified local record still gets the national law, labelled national.
    const rizal = pack("rizal").items.filter((i) => i.kind === "policy");
    expect(rizal.every((i) => i.jurisdiction === "national")).toBe(true);
  });

  it("counts cases over usable weeks only and names the suspect swap weeks", () => {
    for (const item of labItemsForUnit(SIGMA, "quezon-city")) {
      const [, usable, of] = item.text.match(/over (\d+) usable weeks of (\d+)/) ?? [];
      expect(Number(usable)).toBeLessThanOrEqual(Number(of));
    }
    const y2016 = labItemsForUnit(SIGMA, "quezon-city").find((i) => i.id.endsWith("2016"));
    expect(y2016?.text).toMatch(/swap week/);
  });

  it("returns only the pack's own items as citations, in order of first mention", () => {
    const p = pack("quezon-city");
    const reply = "EARS fired first (lab-quezon-city-2019). The LGC assigns duties (pe-national-lgc-1991); see also pe-pasig-tf-2025 and lab-quezon-city-2019-x.";
    expect(citedItems(reply, p).map((i) => i.id)).toEqual(["lab-quezon-city-2019", "pe-national-lgc-1991"]);
  });
});

describe("city isolation", () => {
  const ids = (unitId: string) => pack(unitId).items.map((i) => i.id);

  it("rebuilds the evidence for each place: switching from Quezon City to Pasig keeps none of Quezon City's", () => {
    const pasig = ids("pasig-city");
    expect(pasig.some((id) => id.includes("quezon-city") || id.startsWith("pe-qc"))).toBe(false);
    expect(pasig).toContain("lab-pasig-city-2019");
  });

  it("labels every item with the place it is about, and national items with none", () => {
    for (const item of pack("quezon-city").items) {
      if (item.jurisdiction === "national" || item.jurisdiction === "method") expect(item.unitId).toBeNull();
      else expect(item.unitId).toBe("quezon-city");
    }
  });

  it("keeps a comparison's two places separate, each item naming its own place", () => {
    const both = buildEvidencePack({
      unitId: "quezon-city",
      unitName: "Quezon City",
      sigma: SIGMA,
      national: null,
      accessUnit: accessUnit("quezon-city"),
      policyRecords: getAllPolicyEvidence(),
      compare: { unitId: "pasig-city", unitName: "City of Pasig", accessUnit: accessUnit("pasig-city"), hasUnitData: true },
    });
    const forUnit = (u: string) => both.items.filter((i) => i.unitId === u).map((i) => i.id);
    expect(forUnit("quezon-city").every((id) => id.includes("quezon-city") || id.startsWith("pe-qc"))).toBe(true);
    expect(forUnit("pasig-city").every((id) => id.includes("pasig-city") || id.startsWith("pe-pasig"))).toBe(true);
    // National and method items appear once, not once per place.
    expect(both.items.filter((i) => i.id === "access-medicines-dpri")).toHaveLength(1);
    expect(both.compare).toEqual({ unitId: "pasig-city", unitName: "City of Pasig" });
  });

  it("gives a place with no reporting unit no unit-level evidence, never another place's", () => {
    const none = buildEvidencePack({
      unitId: "antipolo",
      unitName: "Antipolo",
      sigma: SIGMA,
      national: null,
      accessUnit: undefined,
      policyRecords: getAllPolicyEvidence(),
      hasUnitData: false,
    });
    expect(none.items.some((i) => i.kind === "lab" && i.jurisdiction === "reporting unit")).toBe(false);
    expect(none.items.every((i) => i.unitId === null)).toBe(true);
    expect(buildAnalyzePrompt(none, "Dengue")).toMatch(/No reporting-unit data is available for Antipolo/);
  });

  it("rejects another city's evidence ids named in a reply and never cites them", () => {
    const qc = pack("quezon-city");
    const reply = "QC peaked [lab-quezon-city-2019]; Pasig also rose [lab-pasig-city-2019] (pe-pasig-tf-2025).";
    expect(foreignEvidenceIds(reply, qc)).toEqual(["lab-pasig-city-2019", "pe-pasig-tf-2025"]);
    expect(citedItems(reply, qc).map((i) => i.id)).toEqual(["lab-quezon-city-2019"]);
  });

  it("tells the model plainly when a place has no verified local policy", () => {
    expect(buildAnalyzePrompt(pack("rizal"), "Dengue")).toMatch(/No verified local policy record is in SIGMA's evidence for rizal/);
    expect(buildAnalyzePrompt(pack("quezon-city"), "Dengue")).not.toMatch(/No verified local policy record/);
  });

  it("starts every prompt with the same place-free part, so the provider can cache it", () => {
    const qc = buildAnalyzePrompt(pack("quezon-city"), "Dengue");
    const abra = buildAnalyzePrompt(pack("abra"), "Dengue");
    const split = qc.indexOf("THIS REQUEST\n");
    expect(split).toBeGreaterThan(qc.length / 2);
    expect(abra.slice(0, abra.indexOf("THIS REQUEST\n"))).toBe(qc.slice(0, split));
    expect(qc.slice(0, split)).not.toMatch(/quezon-city|abra/i);
    // Each place's own items come after the shared part, never before it.
    expect(qc.indexOf("[lab-quezon-city-2019]")).toBeGreaterThan(split);
    expect(qc.indexOf("[pe-national-ra11332-2019]")).toBeLessThan(split);
  });

  it("fits the free model tier even for the largest place compared with another", () => {
    // Groq refuses a request over ~8K tokens outright; the budget keeps every prompt near 6K.
    const qcWithAgusan = buildEvidencePack({
      unitId: "quezon-city",
      unitName: "Quezon City",
      sigma: SIGMA,
      national: null,
      accessUnit: accessUnit("quezon-city"),
      policyRecords: getAllPolicyEvidence(),
      compare: { unitId: "agusan-del-sur-remainder", unitName: "Agusan del Sur", accessUnit: accessUnit("agusan-del-sur-remainder"), hasUnitData: true },
    });
    const prompt = buildAnalyzePrompt(qcWithAgusan, "Dengue");
    expect(prompt).toContain("[lab-agusan-del-sur-remainder-2019]");
    expect(prompt.length).toBeLessThan(PROMPT_BUDGET_CHARS);
    expect(prompt).not.toMatch(/https?:\/\//);
  });

  it("tells SIGI the exact reply for a question SIGMA has no evidence for", () => {
    expect(buildAnalyzePrompt(pack("abra"), "Dengue")).toContain(`reply with exactly: ${NO_EVIDENCE_REPLY}`);
    expect(NO_EVIDENCE_REPLY).toBe("SIGMA will answer it after some research.");
  });

  it("reads ids written with typographic hyphens as the ids SIGMA issued", () => {
    const qc = pack("quezon-city");
    const reply = normalizeHyphens("Cases peaked in 2019 [lab‑quezon‑city‑2019]; see [method‐ears].");
    expect(citedItems(reply, qc).map((i) => i.id)).toEqual(["lab-quezon-city-2019", "method-ears"]);
    expect(normalizeHyphens("2016–2020 — a range")).toBe("2016–2020 — a range");
  });
});
