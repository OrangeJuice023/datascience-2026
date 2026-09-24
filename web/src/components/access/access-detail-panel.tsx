"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { DataStateNotice } from "@/components/ui/data-state-notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { GAP_LABEL, facilityById, metricFor, stateFor, type AccessBundle } from "@/lib/access/bundle";
import { facilityTypeLabel } from "@/lib/access/labels";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import { GAP_HEX } from "@/lib/map/palette";
import type { LGU } from "@/types";

const AVAILABILITY_LABEL = {
  available: "Available",
  low: "Low",
  unavailable: "Reported unavailable",
  unknown: "Unknown",
} as const;

const FRESHNESS_LABEL = { fresh: "Fresh", aging: "Aging", stale: "Stale", unknown: "No report" } as const;

const QUANTITY_LABEL = { "0": "0", "1-10": "1–10", "11-50": "11–50", "50+": "50+" } as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{children}</dd>
    </div>
  );
}

function Header({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-200 p-4">
      <div>
        <p className="text-[11px] font-medium text-slate-400">{eyebrow}</p>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Facility or area detail for ACCESS. Every value comes from the aggregated
 * demo bundle; limitations are stated in-line rather than hidden.
 */
export function AccessDetailPanel({
  bundle,
  lgus,
  selectedId,
  medicineId,
  weekIndex,
  onClose,
}: {
  bundle: AccessBundle;
  lgus: LGU[];
  selectedId: string;
  medicineId: string;
  weekIndex: number;
  onClose: () => void;
}) {
  const medicine = bundle.medicines.find((m) => m.id === medicineId);
  const week = bundle.weeks[weekIndex];
  const facility = facilityById(bundle, selectedId);

  if (facility) {
    const state = stateFor(bundle, facility.id, medicineId, weekIndex);
    const area = metricFor(bundle, facility.areaId, medicineId, weekIndex);
    const areaName = lgus.find((l) => l.id === facility.areaId)?.name ?? facility.areaId;
    return (
      <div className="flex flex-col">
        <Header eyebrow={`${facilityTypeLabel(facility.type)} · ${areaName}`} title={facility.name} onClose={onClose} />
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          <StatusBadge label="Demo facility record" tone="warning" />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
          <Field label="Type">{facilityTypeLabel(facility.type)}</Field>
          <Field label="Medicine">{medicine?.name ?? medicineId}</Field>
          <Field label="Availability">{state ? AVAILABILITY_LABEL[state.availability] : "Unknown"}</Field>
          <Field label="Quantity (bucket)">
            {state?.quantityBucket ? QUANTITY_LABEL[state.quantityBucket] : "Not reported"}
          </Field>
          <Field label="Last updated">
            {state?.ageHours == null ? "No report" : `${state.ageHours}h before week end`}
          </Field>
          <Field label="Freshness">{state ? FRESHNESS_LABEL[state.freshness] : "No report"}</Field>
          <Field label="Source">{facility.source}</Field>
          <Field label="Nearby demand">
            {area ? `${formatCount(area.searchDemand)} searches in ${areaName}` : "—"}
          </Field>
        </dl>
        <div className="flex flex-col gap-2 px-4 pb-4">
          {(!state || state.freshness === "unknown") && (
            <DataStateNotice state="no-data" title="No inventory report">
              This facility has not reported inventory for this medicine. Availability cannot
              currently be confirmed.
            </DataStateNotice>
          )}
          {state?.freshness === "stale" && (
            <DataStateNotice state="quality-warning" title="Stale report">
              Availability information may be outdated. A stale report is treated as uncertain,
              not as unavailable.
            </DataStateNotice>
          )}
          <p className="text-[11px] text-slate-400">
            Week ending {week ? formatIsoDate(week.periodEnd) : "—"}. Prototype record; no real
            facility or stock level is represented.
          </p>
        </div>
      </div>
    );
  }

  const lgu = lgus.find((l) => l.id === selectedId);
  const metric = metricFor(bundle, selectedId, medicineId, weekIndex);
  if (!lgu || !metric) {
    return (
      <div className="p-4">
        <DataStateNotice state="no-data" title="No inventory data">
          No participating facilities have reported inventory for this medicine in this area.
        </DataStateNotice>
      </div>
    );
  }

  const coveragePct = Math.round(metric.facilityCoverage * 100);
  return (
    <div className="flex flex-col">
      <Header eyebrow={`${lgu.province} · access overview`} title={lgu.name} onClose={onClose} />
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-slate-200"
          style={{ background: `${GAP_HEX[metric.accessGap]}33` }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: GAP_HEX[metric.accessGap] }} aria-hidden="true" />
          {GAP_LABEL[metric.accessGap]} access gap
        </span>
        <StatusBadge label={`${metric.confidence} confidence`} tone="neutral" />
        <StatusBadge label="Demo data" tone="warning" />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
        <Field label="Medicine">{medicine?.name ?? medicineId}</Field>
        <Field label="Week">{week ? formatIsoDate(week.periodStart) : "—"}</Field>
        <Field label="Search demand">
          {formatCount(metric.searchDemand)} ({metric.demandRatio.toFixed(1)}x early level)
        </Field>
        <Field label="Not found nearby">{formatCount(metric.notFoundSearches)} searches</Field>
        <Field label="Confirmed availability">
          {metric.confirmedAvailable} of {metric.facilities} facilities
        </Field>
        <Field label="Unavailable reports">{metric.reportedUnavailable}</Field>
        <Field label="Inventory freshness">
          {metric.staleInventory} stale · {metric.unknownInventory} unknown
        </Field>
        <Field label="Facility coverage">{coveragePct}% current reports</Field>
      </dl>
      <div className="border-t border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-600">Why this is flagged</p>
        {metric.reasons.length > 0 ? (
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            {metric.reasons.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {r}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Demand and confirmed availability are within the demo rule&apos;s normal range.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-slate-200 p-4">
        {metric.accessGap === "insufficient_data" && (
          <DataStateNotice state="partial-coverage" title="Low coverage">
            Only a small portion of facilities are represented, so SIGMA does not assess an access
            gap here.
          </DataStateNotice>
        )}
        {metric.staleInventory > 0 && (
          <DataStateNotice state="quality-warning" title="Stale data">
            Availability information may be outdated for {metric.staleInventory} facility report(s).
          </DataStateNotice>
        )}
        {metric.unknownInventory > 0 && (
          <DataStateNotice state="no-data" title="Unknown availability">
            Availability cannot currently be confirmed for {metric.unknownInventory} facility(ies).
          </DataStateNotice>
        )}
        <p className="text-[11px] text-slate-400">
          A potential access gap describes demand relative to known availability. It is not a
          shortage determination and not a clinical indicator.
        </p>
      </div>
    </div>
  );
}
