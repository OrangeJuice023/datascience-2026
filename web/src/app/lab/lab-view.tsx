"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SelectFilter } from "@/components/ui/select-filter";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { TrendTab } from "@/components/lab/trend-tab";
import { AnomalyTab } from "@/components/lab/anomaly-tab";
import { SpatialTab } from "@/components/lab/spatial-tab";
import { ComparisonTab } from "@/components/lab/comparison-tab";
import { SourcesTab } from "@/components/lab/sources-tab";
import { AskDataPanel } from "@/components/lab/ask-data-panel";
import { NationalObservationsPanel } from "@/components/lab/national-observations-panel";
import { DEMO_DISEASES, getLocationIdsForDisease, getSignal } from "@/data/demo-signals";
import { getLguById } from "@/data/demo-lgus";
import { getTrendSeries } from "@/data/demo-trends";
import type { NationalSummary } from "@/lib/national-observations";

const TABS = [
  { id: "trend", label: "Trend" },
  { id: "anomaly", label: "Anomaly" },
  { id: "spatial", label: "Spatial" },
  { id: "comparison", label: "Comparison" },
  { id: "sources", label: "Sources" },
];

/** Formal observations exist for dengue at national level only. */
const NATIONAL_ID = "ph";
const NATIONAL_DISEASE = "Dengue";

export function LabView({ national }: { national: NationalSummary }) {
  const [disease, setDisease] = useState(NATIONAL_DISEASE);
  const [locationId, setLocationId] = useState(NATIONAL_ID);
  const [activeTab, setActiveTab] = useState("trend");

  const hasNational = disease === NATIONAL_DISEASE;
  const lguIds = getLocationIdsForDisease(disease);
  const effectiveLocationId =
    (locationId === NATIONAL_ID && hasNational) || lguIds.includes(locationId)
      ? locationId
      : (hasNational ? NATIONAL_ID : lguIds[0]);
  const isNational = effectiveLocationId === NATIONAL_ID;

  const lgu = isNational ? undefined : getLguById(effectiveLocationId);
  const signal = isNational ? undefined : getSignal(disease, effectiveLocationId);
  const trend = lgu ? getTrendSeries(lgu.id) : undefined;

  const locationOptions = [
    ...(hasNational
      ? [{ value: NATIONAL_ID, label: "Philippines · national (observed)" }]
      : []),
    ...lguIds.map((id) => ({ value: id, label: `${getLguById(id)?.name ?? id} (demo signal)` })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Trace"
        title="SIGMA Lab"
        subtitle="Investigate the pattern behind the signal."
      />

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <SelectFilter
          label="Disease"
          value={disease}
          onChange={setDisease}
          options={DEMO_DISEASES.map((d) => ({ value: d, label: d }))}
        />
        <SelectFilter
          label="Location"
          value={effectiveLocationId}
          onChange={setLocationId}
          options={locationOptions}
        />
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium text-slate-500">Evidence</p>
          <p className="px-0.5 py-1.5 text-sm text-slate-700">
            {isNational
              ? "Formal observations · OpenDengue v1.3"
              : "Open-source signal · demo data"}
          </p>
        </div>
      </Card>

      {isNational ? (
        <NationalObservationsPanel national={national} />
      ) : lgu && signal && trend ? (
        <Card>
          <Tabs items={TABS} activeId={activeTab} onChange={setActiveTab} />
          <div className="p-4">
            <TabPanel id="trend" activeId={activeTab}>
              <TrendTab signal={signal} trend={trend} />
            </TabPanel>
            <TabPanel id="anomaly" activeId={activeTab}>
              <AnomalyTab signal={signal} trend={trend} />
            </TabPanel>
            <TabPanel id="spatial" activeId={activeTab}>
              <SpatialTab lgu={lgu} signal={signal} />
            </TabPanel>
            <TabPanel id="comparison" activeId={activeTab}>
              <ComparisonTab key={lgu.id} lgu={lgu} signal={signal} trend={trend} />
            </TabPanel>
            <TabPanel id="sources" activeId={activeTab}>
              <SourcesTab />
            </TabPanel>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center text-sm text-slate-400">
          No demo data available for this combination.
        </Card>
      )}

      <AskDataPanel />
    </div>
  );
}
