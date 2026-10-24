import { Suspense, type ReactNode } from "react";
import { SigiHero, type UnitEvidence } from "@/components/analyze/sigi-hero";
import { AnalyzeTabs } from "@/components/layout/analyze-tabs";
import { getAllPolicyEvidence } from "@/data/policy-evidence";
import { ACCESS_REFERENCE, accessUnit } from "@/lib/access/reference";
import { accessReadiness } from "@/lib/access/readiness";
import { isLocalPolicyFor } from "@/lib/analyze-chat/evidence";
import { readSigmaData } from "@/lib/sigma/summary";
import { unitYearSummaries } from "@/lib/sigma/unit-years";

/**
 * Analyze: SIGI first, then ACCESS, Policy and Lab under one secondary
 * navigation. SIGI sits in the layout so its conversation survives switching
 * subtabs.
 */
export default async function AnalyzeLayout({ children }: { children: ReactNode }) {
  const { ready } = accessReadiness(ACCESS_REFERENCE);
  const sigma = await readSigmaData();
  const unitYears = sigma ? unitYearSummaries(sigma) : null;
  const records = getAllPolicyEvidence();
  const units = ACCESS_REFERENCE.units
    .map((u) => ({ id: u.id, name: u.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // The same facts PolicyView used for its suggestions, per unit.
  const evidence: Record<string, UnitEvidence> = Object.fromEntries(
    units.map((u) => [
      u.id,
      {
        hasLab: Boolean(unitYears?.[u.id]?.some((y) => y.usableWeeks > 0)),
        hasAccess: ready && Boolean(accessUnit(u.id)),
        hasLocalPolicy: records.some((r) => isLocalPolicyFor(r.locationId, u.id)),
      },
    ]),
  );

  return (
    <>
      <Suspense fallback={<div className="mx-auto mb-6 h-[24rem] w-full max-w-[820px]" aria-hidden="true" />}>
        <SigiHero units={units} evidence={evidence} />
      </Suspense>
      <AnalyzeTabs accessReady={ready} />
      {children}
    </>
  );
}
