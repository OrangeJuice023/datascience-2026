"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
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

export function PolicyView({ accessAssessments }: { accessAssessments: AccessAssessment[] }) {
  const [disease, setDisease] = useState("Dengue");
  const [locationId, setLocationId] = useState("quezon-city");

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

      {lgu && signal ? (
        <>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Evidence summary
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
              Areas for assessment
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
