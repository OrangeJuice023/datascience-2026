"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PolicyCopilot } from "@/components/policy/policy-copilot";
import { Card } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { SelectFilter } from "@/components/ui/select-filter";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAllPolicyEvidence } from "@/data/policy-evidence";
import { SIGMA_DOES_NOT } from "@/data/demo-policy";
import { getComparison } from "@/data/policy-evidence/comparator";
import { FACILITY_TYPES, FACILITY_TYPE_LABEL, accessUnit } from "@/lib/access/reference";
import { isLocalPolicyFor } from "@/lib/analyze-chat/evidence";
import { copilotConversationKey } from "@/lib/policy-chat/copilot-ui";
import { formatCount } from "@/lib/map/format";
import type { UnitYear } from "@/lib/sigma/unit-years";
import type { PolicyEvidenceRecord, PolicyEvidenceTopic, VerificationStatus } from "@/lib/policy-evidence/types";

const TOPIC_LABEL: Record<PolicyEvidenceTopic, string> = {
  policy_adoption_mandate: "Policy adoption and mandate",
  implementation_organizational: "Documented implementation",
  surveillance_reporting: "Surveillance and reporting",
  budget_procurement_fiscal: "Budget, procurement and fiscal",
  reported_outcomes: "Reported outcomes",
  governance_accountability: "Governance and accountability",
  evidence_gaps_unresolved: "Outstanding evidence gaps",
};

const STATUS: Record<VerificationStatus, { label: string; tone: "info" | "warning" | "neutral" }> = {
  verified: { label: "Verified", tone: "info" },
  partially_verified: { label: "Partially verified", tone: "warning" },
  needs_review: { label: "Needs review", tone: "neutral" },
};

const DISEASE = "Dengue";
const DEFAULT_UNIT = "quezon-city";
const RECORDS = getAllPolicyEvidence();
const NATIONAL_RECORDS = RECORDS.filter((r) => r.locationId === null);

/**
 * Analyze → Policy: SIGI's home in Analyze. Pick a reporting unit (any of the
 * 126) and, optionally, a second one to compare; SIGI answers from the same
 * evidence this page lists for it: its Lab years, its ACCESS facilities, its
 * local policy records and the national ones. Dengue only: it is the only
 * disease with real data in SIGMA.
 */
export function PolicyView({
  accessReady,
  units,
  unitYears,
}: {
  accessReady: boolean;
  units: { id: string; name: string }[];
  unitYears: Record<string, UnitYear[]> | null;
}) {
  const [unitId, setUnitId] = useState(DEFAULT_UNIT);
  const [compareId, setCompareId] = useState("");
  const comparison = useMemo(() => getComparison(), []);

  const unitName = units.find((u) => u.id === unitId)?.name ?? unitId;
  const compare = compareId && compareId !== unitId ? units.find((u) => u.id === compareId) : undefined;
  const localRecords = RECORDS.filter((r) => isLocalPolicyFor(r.locationId, unitId));
  const years = unitYears?.[unitId] ?? null;
  const facilities = accessReady ? accessUnit(unitId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Policy"
        subtitle="Ask SIGI about a place's dengue record, access to care and policy evidence. Every answer cites the evidence it used, and SIGI says what the evidence cannot show."
      />

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <SelectFilter
          label="Reporting unit"
          value={unitId}
          onChange={(next) => {
            setUnitId(next);
            if (next === compareId) setCompareId("");
          }}
          options={units.map((u) => ({ value: u.id, label: u.name }))}
        />
        <SelectFilter
          label="Compare with (optional)"
          value={compareId}
          onChange={setCompareId}
          options={[{ value: "", label: "No comparison" }, ...units.filter((u) => u.id !== unitId).map((u) => ({ value: u.id, label: u.name }))]}
        />
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium text-slate-500">Disease</p>
          <p className="py-1.5 text-sm text-slate-700">Dengue · the only disease with real data in SIGMA</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <PolicyCopilot
          key={copilotConversationKey(DISEASE, compare ? `${unitId}+${compare.id}` : unitId)}
          disease={DISEASE}
          locationId={unitId}
          locationName={unitName}
          compareLocationId={compare?.id}
          compareName={compare?.name}
          suggestionContext={{
            place: unitName,
            hasLab: Boolean(years?.some((y) => y.usableWeeks > 0)),
            hasAccess: Boolean(facilities),
            hasLocalPolicy: localRecords.length > 0,
          }}
        />

        <aside aria-labelledby="evidence-heading" className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <h2 id="evidence-heading" className="text-sm font-semibold text-slate-900">
              Evidence SIGI receives for {unitName}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              The same items SIGI is given and may cite.{compare ? ` ${compare.name}'s evidence is added separately for the comparison.` : ""}
            </p>
          </div>

          <section aria-label="Lab evidence" className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-700">Lab · reported dengue weeks</p>
              <EvidenceBadge kind="formal" />
            </div>
            {years ? (
              <table className="w-full text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 text-left font-medium">Year</th>
                    <th className="py-1 text-right font-medium">Cases</th>
                    <th className="py-1 text-right font-medium">Usable wks</th>
                    <th className="py-1 text-right font-medium">EARS wks</th>
                    <th className="py-1 text-right font-medium">DOH wks</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.year} className="border-t border-slate-100">
                      <td className="py-1">{y.year}</td>
                      <td className="py-1 text-right tabular-nums">{formatCount(y.cases)}</td>
                      <td className="py-1 text-right tabular-nums">
                        {y.usableWeeks}/{y.weeks}
                      </td>
                      <td className="py-1 text-right tabular-nums">{y.earsWeeks}</td>
                      <td className="py-1 text-right tabular-nums">{y.year >= 2019 ? y.dohWeeks : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-slate-500">The reporting-unit results could not be read.</p>
            )}
            <p className="text-[11px] text-slate-500">
              DOH thresholds start in 2019. Missing and suspect weeks are not usable and add no cases.
            </p>
          </section>

          <section aria-label="ACCESS evidence" className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-700">ACCESS · mapped facilities</p>
            {facilities ? (
              <p className="text-xs text-slate-600">
                {FACILITY_TYPES.map((t) => `${facilities.mappedFacilities[t]} ${FACILITY_TYPE_LABEL[t].toLowerCase()}`).join(", ")}{" "}
                mapped in OpenStreetMap, plus DOH medicine prices.{" "}
                <Link href="/analyze/access" className="font-medium text-accent hover:underline">
                  Open ACCESS
                </Link>
              </p>
            ) : (
              <p className="text-xs text-slate-500">ACCESS has no figures for this place.</p>
            )}
            <p className="text-[11px] text-slate-500">Medicine stock is unknown: no public source reports it.</p>
          </section>

          <section aria-label="Policy evidence" className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-700">Policy · local to {unitName}</p>
            {localRecords.length === 0 ? (
              <p className="text-xs text-slate-500">
                No verified local record is in SIGMA for {unitName}. SIGI will say so and use the national records.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {localRecords.map((r) => (
                  <EvidenceItem key={r.evidenceId} record={r} />
                ))}
              </ul>
            )}
            {NATIONAL_RECORDS.length > 0 && (
              <>
                <p className="mt-1 text-xs font-semibold text-slate-700">Policy · national (applies everywhere)</p>
                <ul className="flex flex-col gap-2">
                  {NATIONAL_RECORDS.map((r) => (
                    <EvidenceItem key={r.evidenceId} record={r} />
                  ))}
                </ul>
              </>
            )}
          </section>
        </aside>
      </div>

      <section aria-labelledby="supporting-heading" className="flex flex-col gap-2">
        <h2 id="supporting-heading" className="text-sm font-semibold text-slate-900">
          Supporting analysis
        </h2>

        <Disclosure
          title="Comparative LGU analysis"
          summary="Qualitative comparison of four LGUs. No scores or rankings; missing evidence does not mean a program is absent."
          badge={<StatusBadge label="Source-backed" tone="info" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  {["LGU", "Policy/mandate", "Implementation", "Alert-to-response", "Surveillance/reporting", "Financial evidence", "Outcomes", "Gaps"].map((h) => (
                    <th key={h} scope="col" className="pb-2 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.locationId} className="border-b border-slate-100 align-top">
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-800">{row.city}</th>
                    <td className="py-2 pr-3 text-slate-600">{row.policyAdoption}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.implementation}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.alertToResponse}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.surveillanceReporting}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.financial}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.outcomes}</td>
                    <td className="py-2 text-slate-600">{row.gaps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>

        <Disclosure
          title="Proposed signal-to-action framework"
          summary="A proposal for discussion. Not current law or a uniform LGU protocol."
          badge={<StatusBadge label="Proposal only" tone="neutral" />}
        >
          <p className="text-xs text-slate-500">
            Requires local public-health, legal, budget and governance review. SIGMA does not declare outbreaks or
            authorize expenditure.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Validated surveillance inputs</li>
            <li>Interpretable statistical warnings</li>
            <li>Human-led epidemiological review</li>
            <li>Documented response and action closure</li>
            <li>Continuous evaluation</li>
          </ol>
          <p className="mt-3 text-xs font-medium text-slate-600">Accountability sequence</p>
          <p className="mt-1 text-xs text-slate-500">
            Data source and quality → signal recipient → authorized review → escalation decision → assigned action →
            completion evidence → evaluation
          </p>
        </Disclosure>

        <Disclosure title="What SIGMA does not do" summary="The limits that apply to every page, including SIGI.">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            {SIGMA_DOES_NOT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Disclosure>
      </section>
    </div>
  );
}

/** One curated record: the claim, its status and source, with caveats on demand. */
function EvidenceItem({ record: r }: { record: PolicyEvidenceRecord }) {
  const status = STATUS[r.verificationStatus];
  const details = r.caveats.length + r.unresolvedQuestions.length;
  return (
    <li id={`evidence-${r.evidenceId}`} className="scroll-mt-20 rounded-md border border-slate-200 p-3 target:ring-2 target:ring-accent">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-500">{TOPIC_LABEL[r.topic]}</span>
        <StatusBadge label={status.label} tone={status.tone} className="px-2 py-0.5" />
      </div>
      <p className="mt-1.5 text-sm text-slate-800">{r.claim}</p>
      <p className="mt-1.5 text-xs text-slate-500">
        {r.issuingOrganization}
        {r.publicationDate ? `, ${r.publicationDate}` : ""}
        {r.financialStage ? ` · stage: ${r.financialStage.replace(/_/g, " ")}` : ""}
        {r.amount ? ` · ${r.amount}` : ""}
      </p>
      {r.sourceUrl && (
        <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline">
          {r.sourceTitle}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
      {details > 0 && (
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-800">Caveats and open questions ({details})</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {r.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
            {r.unresolvedQuestions.map((q) => (
              <li key={q}>Open: {q}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
