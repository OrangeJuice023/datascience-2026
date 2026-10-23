"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PolicyCopilot } from "@/components/policy/policy-copilot";
import { Card } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { SelectFilter } from "@/components/ui/select-filter";
import { SignalBadge } from "@/components/ui/signal-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DEMO_DISEASES, getLocationIdsForDisease, getSignal } from "@/data/demo-signals";
import { getLguById } from "@/data/demo-lgus";
import type { AccessAssessment } from "@/lib/access/assessments";
import { copilotConversationKey } from "@/lib/policy-chat/copilot-ui";
import { DEMO_EVIDENCE_SUMMARY, DEMO_POLICY_INSIGHTS, SIGMA_DOES_NOT } from "@/data/demo-policy";
import { getComparison } from "@/data/policy-evidence/comparator";
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

type EvidenceState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; records: PolicyEvidenceRecord[] };

export function PolicyView({ accessAssessments }: { accessAssessments: AccessAssessment[] }) {
  const [disease, setDisease] = useState("Dengue");
  const [locationId, setLocationId] = useState("quezon-city");
  const [reloadKey, setReloadKey] = useState(0);
  // The last finished request, tagged with what it was for; anything else is loading.
  const [result, setResult] = useState<{ key: string; state: EvidenceState } | null>(null);
  const comparison = useMemo(() => getComparison(), []);

  const locationOptions = useMemo(() => getLocationIdsForDisease(disease), [disease]);
  const effectiveLocationId = locationOptions.includes(locationId) ? locationId : (locationOptions[0] ?? "quezon-city");
  const lgu = getLguById(effectiveLocationId);
  const signal = getSignal(disease, effectiveLocationId);

  function handleDiseaseChange(next: string) {
    setDisease(next);
    const nextLocations = getLocationIdsForDisease(next);
    if (!nextLocations.includes(locationId)) setLocationId(nextLocations[0] ?? "quezon-city");
  }

  const requestKey = `${effectiveLocationId}#${reloadKey}`;
  const evidence: EvidenceState = result?.key === requestKey ? result.state : { kind: "loading" };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/policy/evidence?locationId=${encodeURIComponent(effectiveLocationId)}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error?.message ?? "The evidence could not be loaded.");
        setResult({ key: requestKey, state: { kind: "ready", records: (body?.data?.records ?? []) as PolicyEvidenceRecord[] } });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const message = e instanceof Error ? e.message : "The evidence could not be loaded.";
        setResult({ key: requestKey, state: { kind: "error", message } });
      });
    return () => controller.abort();
  }, [effectiveLocationId, requestKey]);

  // The copilot is given only this LGU's records (lib/policy-chat/context.ts);
  // national records are shown for context but are not sent to the model.
  const records = evidence.kind === "ready" ? evidence.records : [];
  const lguRecords = records.filter((r) => r.locationId === effectiveLocationId);
  const nationalRecords = records.filter((r) => r.locationId === null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Act"
        title="LGU Decision Support"
        subtitle="Ask about an LGU's evidence, then check the sources. SIGMA points to what to verify; it does not prescribe policy."
      />

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <SelectFilter
          label="LGU"
          value={effectiveLocationId}
          onChange={setLocationId}
          options={locationOptions.map((id) => ({ value: id, label: getLguById(id)?.name ?? id }))}
        />
        <SelectFilter
          label="Signal"
          value={disease}
          onChange={handleDiseaseChange}
          options={DEMO_DISEASES.map((d) => ({ value: d, label: d }))}
        />
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium text-slate-500">Signal status (demo)</p>
          <div className="py-1.5">
            {signal ? <SignalBadge status={signal.status} /> : <span className="text-xs text-slate-500">No demo signal</span>}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <PolicyCopilot
          key={copilotConversationKey(disease, effectiveLocationId)}
          disease={disease}
          locationId={effectiveLocationId}
          locationName={lgu?.name}
          hasSignal={!!signal}
          evidence={lguRecords}
        />

        <aside aria-labelledby="evidence-heading" className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <h2 id="evidence-heading" className="text-sm font-semibold text-slate-900">
              Evidence the Copilot receives
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Curated, source-backed records for {lgu?.name ?? effectiveLocationId}. Reported outcomes are not assumed
              causal.
            </p>
          </div>
          {evidence.kind === "loading" && <p className="text-sm text-slate-500">Loading evidence…</p>}
          {evidence.kind === "error" && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span>{evidence.message}</span>
              <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="text-xs font-medium underline">
                Retry
              </button>
            </div>
          )}
          {evidence.kind === "ready" && lguRecords.length === 0 && (
            <p className="text-sm text-slate-500">
              No curated records for this LGU. The Copilot will say that evidence is insufficient.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {lguRecords.map((r) => (
              <EvidenceItem key={r.evidenceId} record={r} />
            ))}
          </ul>
          {nationalRecords.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-600">National context</p>
              <p className="mb-2 text-xs text-slate-500">Shown for reference; not sent to the Copilot.</p>
              <ul className="flex flex-col gap-2">
                {nationalRecords.map((r) => (
                  <EvidenceItem key={r.evidenceId} record={r} />
                ))}
              </ul>
            </div>
          )}
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
          title="Areas for assessment"
          summary={`${DEMO_POLICY_INSIGHTS.length} review prompts and the evidence summary for this signal.`}
          badge={<StatusBadge label="Demo data" tone="warning" />}
        >
          {lgu && signal ? (
            <div className="flex flex-col gap-4">
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {DEMO_POLICY_INSIGHTS.map((insight) => (
                  <li key={insight.category} className="rounded-md border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-700">{insight.category}</p>
                    <p className="mt-1 text-sm text-slate-600">{insight.rationale}</p>
                    <p className="mt-1.5 text-[11px] text-slate-500">Evidence type: {insight.evidenceType}</p>
                  </li>
                ))}
              </ul>
              <div>
                <p className="text-xs font-semibold text-slate-700">Evidence summary</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {DEMO_EVIDENCE_SUMMARY.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No demo signal for this LGU and disease, so there are no review prompts.</p>
          )}
        </Disclosure>

        <Disclosure
          title="Medicine access"
          summary="Areas for assessment from the ACCESS module."
          badge={<StatusBadge label="ACCESS · demo data" tone="warning" />}
        >
          <p className="text-xs text-slate-500">
            Latest demo week. Review prompts only; SIGMA does not recommend purchasing or distributing any medicine.{" "}
            <Link href="/access" className="font-medium text-accent hover:underline">
              Open Access
            </Link>
          </p>
          {accessAssessments.length > 0 ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {accessAssessments.slice(0, 6).map((a) => (
                <li key={`${a.areaId}-${a.medicineId}`} className="py-2.5 text-sm">
                  <p className="font-medium text-slate-800">
                    {getLguById(a.areaId)?.name ?? a.areaId}, {a.medicineName}: {a.gapLabel.toLowerCase()} gap
                    <span className="ml-1 text-xs font-normal text-slate-500">({a.confidence} confidence)</span>
                  </p>
                  <p className="text-slate-600">{a.areaForAssessment}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No access indicators need review.</p>
          )}
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

        <Disclosure title="What SIGMA does not do" summary="The limits that apply to every page, including the Copilot.">
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
