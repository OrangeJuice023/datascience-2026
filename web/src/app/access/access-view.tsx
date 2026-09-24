"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DataStateNotice } from "@/components/ui/data-state-notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { AnalyticalMap } from "@/components/maps/analytical/analytical-map";
import { AccessDetailPanel } from "@/components/access/access-detail-panel";
import { ACCESS_MODE } from "@/lib/map/modes/access";
import { ACCESS_METRIC_LABEL, type AccessMetricView } from "@/lib/access/bundle";
import type { AccessAssessment } from "@/lib/access/assessments";
import type { MapDataBundle, MapFilters, MapLayerToggles, MapViewMode, ModeFrame } from "@/lib/map/types";
import { cn } from "@/lib/utils";

const METRICS = Object.keys(ACCESS_METRIC_LABEL) as AccessMetricView[];
const EMPTY_FRAME: ModeFrame = { features: [], links: [] };
const FLOW = ["Medicine demand", "Facility availability", "Inventory freshness", "Geographic context"];

export function AccessView({
  bundle,
  assessments,
}: {
  bundle: MapDataBundle;
  assessments: AccessAssessment[];
}) {
  const access = bundle.access;
  const [medicineId, setMedicineId] = useState(access.medicines[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [metric, setMetric] = useState<AccessMetricView>("gap");
  const [view, setView] = useState<MapViewMode>("2d");
  const [toggles, setToggles] = useState<MapLayerToggles>({ links: false, columns: true });
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState<number | null>(null);

  const filters = useMemo<MapFilters>(
    () => ({
      disease: "all",
      geography: "all",
      status: "all",
      confidence: "all",
      window: "all",
      medicine: medicineId,
      accessMetric: metric,
    }),
    [medicineId, metric],
  );
  const prepared = useMemo(() => ACCESS_MODE.prepare?.(bundle, filters) ?? null, [bundle, filters]);
  const latest = Math.max(0, (prepared?.timeline.slices.length ?? 1) - 1);
  const weekIndex = index === null ? latest : Math.min(index, latest);
  const frame = useMemo(() => prepared?.frameAt(weekIndex, toggles) ?? EMPTY_FRAME, [prepared, weekIndex, toggles]);
  const ranked = useMemo(() => [...frame.features].sort((a, b) => b.rank - a.rank), [frame.features]);

  const matches = access.medicines.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()));
  const medicine = access.medicines.find((m) => m.id === medicineId);
  const weekAssessments = assessments.filter((a) => a.medicineId === medicineId);
  const lguName = (id: string) => bundle.lgus.find((l) => l.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Access"
        title="ACCESS"
        subtitle="Explore medicine availability, search demand, and potential access gaps."
      />

      <DataStateNotice state="quality-warning" title="Demo data · prototype">
        Facilities, inventory reports and search events on this page are synthetic prototype
        records. No real pharmacy, facility or stock level is represented, and nothing here is a
        shortage determination or a medical recommendation.
      </DataStateNotice>

      {/* Conceptual flow */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {FLOW.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700">{step}</span>
              {i < FLOW.length - 1 && <span className="text-slate-300">+</span>}
            </span>
          ))}
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span className="rounded-md bg-slate-900 px-2 py-1 font-medium text-white">Access analysis</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700">Potential access gap</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700">Decision support</span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          In SIGMA, ACCESS sits between ANALYZE and ACT: a disease signal (TRACE) and elevated
          activity (ANALYZE) may coincide with rising medicine searches and limited or stale
          availability (ACCESS). This prototype shows that relationship conceptually and computes
          no correlation between them.
        </p>
      </Card>

      {/* Controls */}
      <Card className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="medicine-search" className="text-[11px] font-medium text-slate-500">
            Medicine (demo list)
          </label>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="medicine-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search medicines"
              className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div role="radiogroup" aria-label="Medicine" className="flex flex-wrap gap-1.5">
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={m.id === medicineId}
                onClick={() => setMedicineId(m.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  m.id === medicineId ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                {m.name}
              </button>
            ))}
            {matches.length === 0 && <p className="text-xs text-slate-400">No demo medicine matches “{query}”.</p>}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium text-slate-500">Metric</p>
          <div role="radiogroup" aria-label="Access metric" className="flex flex-wrap rounded-md border border-slate-200 bg-slate-50 p-0.5">
            {METRICS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={metric === k}
                onClick={() => {
                  setMetric(k);
                  setSelectedId(undefined);
                }}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium",
                  metric === k ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800",
                )}
              >
                {ACCESS_METRIC_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          <AnalyticalMap
            modes={[ACCESS_MODE]}
            mode={ACCESS_MODE}
            onModeChange={() => undefined}
            view={view}
            onViewChange={setView}
            toggles={toggles}
            onTogglesChange={setToggles}
            prepared={prepared}
            frame={frame}
            index={weekIndex}
            onIndexChange={setIndex}
            playing={playing}
            onPlayingChange={setPlaying}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hideModeTabs
          />
        </Card>

        <div className="flex flex-col gap-4">
          {selectedId ? (
            <Card className="overflow-hidden">
              <AccessDetailPanel
                bundle={access}
                lgus={bundle.lgus}
                selectedId={selectedId}
                medicineId={medicineId}
                weekIndex={weekIndex}
                onClose={() => setSelectedId(undefined)}
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  {metric === "availability" || metric === "freshness" ? "Facilities" : "Areas"} ·{" "}
                  {ACCESS_METRIC_LABEL[metric]}
                </p>
                <p className="text-xs text-slate-500">
                  {medicine?.name} · {ranked.length} shown. Select one for detail.
                </p>
              </div>
              <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
                {ranked.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(f.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-slate-300"
                        style={{ background: `rgb(${f.color[0]} ${f.color[1]} ${f.color[2]})` }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{f.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">{f.classLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* ACCESS → ACT */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Areas for assessment</h2>
            <StatusBadge label="Feeds ACT" tone="info" />
          </div>
          <Link href="/policy" className="text-xs font-medium text-accent hover:underline">
            Open in ACT →
          </Link>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {medicine?.name}, latest demo week. SIGMA suggests what to review; it does not prescribe
          procurement or policy.
        </p>
        {weekAssessments.length > 0 ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {weekAssessments.map((a) => (
              <li key={`${a.areaId}-${a.medicineId}`} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-800">
                  {lguName(a.areaId)} · {a.gapLabel} access gap
                  <span className="ml-1 text-xs font-normal text-slate-400">({a.confidence} confidence)</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Area for assessment: </span>
                  {a.areaForAssessment}
                </p>
                {a.observed.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                    {a.observed.map((o) => (
                      <li key={o}>· {o}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No area shows a potential access gap for this medicine in the latest demo week.
          </p>
        )}
      </Card>
    </div>
  );
}
