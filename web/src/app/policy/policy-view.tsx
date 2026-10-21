"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { XCircle, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PolicyCopilot } from "@/components/policy/policy-copilot";
import { Card } from "@/components/ui/card";
import { SelectFilter } from "@/components/ui/select-filter";
import { SignalBadge } from "@/components/ui/signal-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DEMO_DISEASES,
  getLocationIdsForDisease,
  getSignal,
} from "@/data/demo-signals";
import { getLguById } from "@/data/demo-lgus";
import type { AccessAssessment } from "@/lib/access/assessments";
import {
  DEMO_EVIDENCE_SUMMARY,
  DEMO_POLICY_INSIGHTS,
  SIGMA_DOES_NOT,
} from "@/data/demo-policy";
import { getComparison } from "@/data/policy-evidence/comparator";

const POLICY_EVIDENCE_LGUS = [
  { id: "quezon-city", name: "Quezon City" },
  { id: "pasig", name: "Pasig City" },
  { id: "davao-city", name: "Davao City" },
  { id: "bacolod-city", name: "Bacolod City" },
];

const TOPIC_GROUPS = [
  { key: "policy_adoption_mandate", label: "Institutional arrangements and policy adoption" },
  { key: "implementation_organizational", label: "Documented implementation" },
  { key: "surveillance_reporting", label: "Surveillance and reporting" },
  { key: "budget_procurement_fiscal", label: "Budget, procurement and fiscal evidence" },
  { key: "reported_outcomes", label: "Reported outcomes" },
  { key: "governance_accountability", label: "Governance and accountability" },
  { key: "evidence_gaps_unresolved", label: "Outstanding evidence gaps" },
] as const;

function statusLabel(s: string) {
  if (s === "verified") return "Verified";
  if (s === "partially_verified") return "Partially verified";
  return "Needs review";
}

function statusTone(s: string): "info" | "warning" | "neutral" {
  if (s === "verified") return "info";
  if (s === "partially_verified") return "warning";
  return "neutral";
}

export function PolicyView({ accessAssessments }: { accessAssessments: AccessAssessment[] }) {
  const [disease, setDisease] = useState("Dengue");
  const [locationId, setLocationId] = useState("quezon-city");
  const [evidence, setEvidence] = useState<any[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const comparison = useMemo(() => getComparison(), []);

  const locationOptions = useMemo(
    () => getLocationIdsForDisease(disease),
    [disease],
  );
  const effectiveLocationId = locationOptions.includes(locationId)
    ? locationId
    : (locationOptions[0] ?? "quezon-city");

  const lgu = getLguById(effectiveLocationId);
  const signal = getSignal(disease, effectiveLocationId);

  function handleDiseaseChange(next: string) {
    setDisease(next);
    const nextLocations = getLocationIdsForDisease(next);
    if (!nextLocations.includes(locationId)) {
      setLocationId(nextLocations[0] ?? "quezon-city");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setEvidenceLoading(true);
      setEvidenceError(null);
      try {
        const res = await fetch(`/api/v1/policy/evidence?locationId=${encodeURIComponent(effectiveLocationId)}`);
        if (!res.ok) throw new Error("Failed to load evidence");
        const json = await res.json();
        if (!cancelled) setEvidence(json?.data?.records || []);
      } catch (e: any) {
        if (!cancelled) setEvidenceError(e?.message || "Failed to load evidence");
      } finally {
        if (!cancelled) setEvidenceLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [effectiveLocationId]);

  const grouped = useMemo(() => {
    const out: Record<string, any[]> = {};
    for (const g of TOPIC_GROUPS) out[g.key] = [];
    for (const r of evidence) {
      if (out[r.topic]) out[r.topic].push(r);
    }
    return out;
  }, [evidence]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Act"
        title="LGU Decision Support"
        subtitle="Translate observed signals and analytical findings into areas for verification and assessment. SIGMA does not prescribe policy."
      />

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <SelectFilter
          label="Selected LGU"
          value={effectiveLocationId}
          onChange={setLocationId}
          options={locationOptions.map((id) => {
            const l = getLguById(id);
            return { value: id, label: l?.name ?? id };
          })}
        />
        <SelectFilter
          label="Signal"
          value={disease}
          onChange={handleDiseaseChange}
          options={DEMO_DISEASES.map((d) => ({ value: d, label: d }))}
        />
        {signal && (
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-medium text-slate-500">
              Signal status
            </p>
            <div className="py-1.5">
              <SignalBadge status={signal.status} />
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">LGU Policy Evidence (source-backed research)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Curated from the policy research pack. Claims are distinguished by verification status; reported outcomes are not assumed causal.
        </p>
        {evidenceLoading && <p className="mt-3 text-sm text-slate-500">Loading evidence…</p>}
        {evidenceError && <p className="mt-3 text-sm text-amber-600">{evidenceError}</p>}
        {!evidenceLoading && !evidenceError && (
          <div className="mt-4 flex flex-col gap-4">
            {TOPIC_GROUPS.map((g) => {
              const items = grouped[g.key] || [];
              if (items.length === 0) return null;
              return (
                <div key={g.key}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</h3>
                  <div className="flex flex-col gap-2">
                    {items.map((r: any) => (
                      <Card key={r.evidenceId} className="p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800">{r.claim}</p>
                          <StatusBadge label={statusLabel(r.verificationStatus)} tone={statusTone(r.verificationStatus)} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{r.entityName}</span>
                          <span>•</span>
                          <span>{r.issuingOrganization}</span>
                          {r.publicationDate && (
                            <>
                              <span>•</span>
                              <span>{r.publicationDate}</span>
                            </>
                          )}
                          {r.referencePeriod && (
                            <>
                              <span>•</span>
                              <span>Ref: {r.referencePeriod}</span>
                            </>
                          )}
                        </div>
                        {r.sourceUrl && (
                          <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                            {r.sourceTitle} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {r.caveats && r.caveats.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs text-slate-500">
                            {r.caveats.map((c: string, i: number) => (
                              <li key={i}>• {c}</li>
                            ))}
                          </ul>
                        )}
                        {r.unresolvedQuestions && r.unresolvedQuestions.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-slate-600">Outstanding questions</p>
                            <ul className="mt-1 space-y-1 text-xs text-slate-500">
                              {r.unresolvedQuestions.map((q: string, i: number) => (
                                <li key={i}>• {q}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {r.financialStage && (
                          <p className="mt-1 text-xs text-slate-400">Financial stage: {r.financialStage}{r.amount ? ` • ${r.amount}` : ""}</p>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
            {evidence.length === 0 && <p className="text-sm text-slate-500">No curated evidence records for this location.</p>}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Comparative LGU Analysis (source-backed)</h2>
        <p className="mt-1 text-xs text-slate-500">Qualitative comparison only. No scores or rankings. Missing evidence does not imply absence of a program.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-3">LGU</th>
                <th className="pb-2 pr-3">Policy/mandate</th>
                <th className="pb-2 pr-3">Implementation</th>
                <th className="pb-2 pr-3">Alert-to-response</th>
                <th className="pb-2 pr-3">Surveillance/reporting</th>
                <th className="pb-2 pr-3">Financial evidence</th>
                <th className="pb-2 pr-3">Outcomes</th>
                <th className="pb-2">Gaps</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.locationId} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-medium text-slate-800">{row.city}</td>
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
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Proposed Signal-to-Action Framework (proposal only)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Requires local public-health, legal, budget and governance review. Not current law or a uniform LGU protocol. SIGMA does not declare outbreaks or authorize expenditure.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Validated surveillance inputs</li>
          <li>Interpretable statistical warnings</li>
          <li>Human-led epidemiological review</li>
          <li>Documented response and action closure</li>
          <li>Continuous evaluation</li>
        </ol>
        <p className="mt-3 text-xs font-medium text-slate-600">Accountability sequence</p>
        <p className="mt-1 text-xs text-slate-500">Data source and quality → signal recipient → authorized review → escalation decision → assigned action → completion evidence → evaluation</p>
      </Card>

      {lgu && signal ? (
        <>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Evidence summary (demo)
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {DEMO_EVIDENCE_SUMMARY.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Areas for assessment (demo)
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {DEMO_POLICY_INSIGHTS.map((insight, i) => (
                <Card key={insight.category} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {i + 1}. {insight.category}
                    </p>
                    <StatusBadge label="Area for assessment" tone="info" />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">Why: </span>
                    {insight.rationale}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Evidence type: {insight.evidenceType}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Medicine access: areas for assessment
                </h2>
                <StatusBadge label="From ACCESS · demo data" tone="warning" />
              </div>
              <Link href="/access" className="text-xs font-medium text-accent hover:underline">
                Open ACCESS →
              </Link>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Latest demo week. Review prompts only; SIGMA does not recommend purchasing or
              distributing any medicine.
            </p>
            {accessAssessments.length > 0 ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {accessAssessments.slice(0, 6).map((a) => (
                  <li key={`${a.areaId}-${a.medicineId}`} className="py-2.5 text-sm">
                    <p className="font-medium text-slate-800">
                      {getLguById(a.areaId)?.name ?? a.areaId} · {a.medicineName} · {a.gapLabel}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        ({a.confidence} confidence)
                      </span>
                    </p>
                    <p className="text-slate-600">
                      <span className="font-medium text-slate-700">Area for assessment: </span>
                      {a.areaForAssessment}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No access indicators need review.</p>
            )}
          </Card>

          <PolicyCopilot
            disease={disease}
            locationId={effectiveLocationId}
            locationName={lgu?.name}
            hasSignal={!!signal}
          />

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-900">
                What SIGMA does not do
              </h2>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              {SIGMA_DOES_NOT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center text-sm text-slate-400">
          No demo data available for this combination.
        </Card>
      )}
    </div>
  );
}
