"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { MethodTab } from "@/components/lab/method-tab";
import { SourcesTab } from "@/components/lab/sources-tab";
import { ReportingUnitsTab } from "@/components/lab/units/reporting-units-tab";
import {
  NationalObservationsPanel,
  type ObservationSourceMeta,
} from "@/components/lab/national-observations-panel";
import { DataStateNotice } from "@/components/ui/data-state-notice";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import type { NationalSummary } from "@/lib/national-observations";
import type { SigmaLabSummary } from "@/lib/sigma/lab";
import type { AnomalyResult } from "@/types/data";

export type NationalLoad =
  | { status: "ok"; national: NationalSummary; meta: ObservationSourceMeta; anomalies: AnomalyResult[] }
  | { status: "unavailable"; message: string };

export type UnitsLoad =
  | { status: "ok"; summary: SigmaLabSummary }
  | { status: "unavailable"; message: string };

const TABS = [
  { id: "national", label: "National trend" },
  { id: "units", label: "Reporting units" },
  { id: "method", label: "Method & data quality" },
  { id: "sources", label: "Sources" },
];

function UnitsUnavailable({ message }: { message: string }) {
  return (
    <DataStateNotice state="source-unavailable" title="Reporting-unit data unavailable">
      {message} No results are shown rather than substitute values.
    </DataStateNotice>
  );
}

/**
 * Lab: dengue only, real data only. The national weekly series comes from
 * OpenDengue v1.3; the reporting-unit analysis (EARS and DOH thresholds) from
 * the SIGMA export of the HDX DOH dengue data.
 */
export function LabView({ load, units }: { load: NationalLoad; units: UnitsLoad }) {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [unitId, setUnitId] = useState(units.status === "ok" ? (units.summary.units[0]?.id ?? "") : "");

  const unitCount = units.status === "ok" ? `${units.summary.units.length} reporting units` : "reporting units";
  const evidence =
    activeTab === "national"
      ? "OpenDengue v1.3 · Philippines, national, weekly"
      : activeTab === "sources"
        ? "OpenDengue v1.3 and HDX DOH dengue"
        : `HDX DOH dengue · ${unitCount}, weekly, 2016–2021`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="SIGMA Lab"
        subtitle="Investigate the pattern behind the signal."
      />

      <Card className="flex flex-wrap items-end gap-x-8 gap-y-3 p-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium text-slate-500">Disease</p>
          <p className="py-1.5 text-sm font-medium text-slate-900">Dengue</p>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[11px] font-medium text-slate-500">Evidence</p>
          <p className="flex flex-wrap items-center gap-2 py-1.5 text-sm text-slate-700">
            <EvidenceBadge kind="formal" />
            Formal observations · {evidence}
          </p>
        </div>
      </Card>

      <Card>
        <Tabs items={TABS} activeId={activeTab} onChange={setActiveTab} />
        <div className="p-4">
          <TabPanel id="national" activeId={activeTab}>
            {load.status === "ok" ? (
              <NationalObservationsPanel national={load.national} meta={load.meta} anomalies={load.anomalies} />
            ) : (
              <DataStateNotice state="source-unavailable" title="Formal data source unavailable">
                {load.message} No observations are shown rather than substitute values.
              </DataStateNotice>
            )}
          </TabPanel>
          <TabPanel id="units" activeId={activeTab}>
            {units.status === "ok" ? (
              <ReportingUnitsTab units={units.summary.units} unitId={unitId} onUnitChange={setUnitId} />
            ) : (
              <UnitsUnavailable message={units.message} />
            )}
          </TabPanel>
          <TabPanel id="method" activeId={activeTab}>
            {units.status === "ok" ? <MethodTab summary={units.summary} /> : <UnitsUnavailable message={units.message} />}
          </TabPanel>
          <TabPanel id="sources" activeId={activeTab}>
            <SourcesTab />
          </TabPanel>
        </div>
      </Card>
    </div>
  );
}
