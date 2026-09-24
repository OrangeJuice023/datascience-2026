"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SelectFilter } from "@/components/ui/select-filter";
import { Button } from "@/components/ui/button";
import { AnalyticalMap } from "@/components/maps/analytical/analytical-map";
import { LocationDetailPanel } from "@/components/maps/location-detail-panel";
import { AccessDetailPanel } from "@/components/access/access-detail-panel";
import { ACCESS_METRIC_LABEL, type AccessMetricView } from "@/lib/access/bundle";
import { MAP_MODES, getMapMode } from "@/lib/map/modes";
import { applySignalFilters } from "@/lib/map/modes/signals";
import type {
  FilterKey,
  MapDataBundle,
  MapFeature,
  MapFilters,
  MapLayerToggles,
  MapModeId,
  MapViewMode,
  ModeFrame,
} from "@/lib/map/types";
import { SEVERITY_ORDER } from "@/lib/status";
import { daysBetweenIso, formatCount, formatIsoDate } from "@/lib/map/format";
import { EvidenceBadge } from "@/components/ui/evidence-badge";

const DEFAULT_FILTERS: MapFilters = {
  disease: "all",
  geography: "all",
  status: "all",
  confidence: "all",
  window: "7",
  medicine: "oral-rehydration-salts",
  accessMetric: "gap",
};

const EMPTY_FRAME: ModeFrame = { features: [], links: [] };
const BASE_TOGGLES: MapLayerToggles = { links: false, columns: true };

function rgb(feature: MapFeature) {
  return `rgb(${feature.color[0]} ${feature.color[1]} ${feature.color[2]})`;
}

export function ExploreView({
  bundle,
  diseases,
  provinces,
}: {
  bundle: MapDataBundle;
  diseases: string[];
  provinces: string[];
}) {
  const [modeId, setModeId] = useState<MapModeId>("signals");
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<MapViewMode>("2d");
  const [toggleOverrides, setToggleOverrides] = useState<Partial<Record<MapModeId, MapLayerToggles>>>({});
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [playing, setPlaying] = useState(false);
  // The timeline position belongs to one mode; switching modes starts at that mode's latest slice.
  const [time, setTime] = useState<{ modeId: MapModeId; index: number } | null>(null);

  const mode = getMapMode(modeId);
  const toggles = useMemo(
    () => toggleOverrides[modeId] ?? { ...BASE_TOGGLES, ...mode.defaultToggles },
    [toggleOverrides, modeId, mode],
  );
  const prepared = useMemo(() => mode.prepare?.(bundle, filters) ?? null, [mode, bundle, filters]);
  const latest = Math.max(0, (prepared?.timeline.slices.length ?? 1) - 1);
  const index = time?.modeId === modeId ? Math.min(time.index, latest) : latest;
  const frame = useMemo(
    () => prepared?.frameAt(index, toggles) ?? EMPTY_FRAME,
    [prepared, index, toggles],
  );
  const slice = prepared?.timeline.slices[index];

  const selectedLgu = selectedId ? bundle.lgus.find((lgu) => lgu.id === selectedId) : undefined;
  const selectedFeature = selectedId ? frame.features.find((f) => f.id === selectedId) : undefined;
  const selectedSignal = useMemo(() => {
    if (!selectedId) return undefined;
    const pool = modeId === "signals" ? applySignalFilters(bundle, filters) : bundle.signals;
    return pool
      .filter((s) => s.locationId === selectedId)
      .sort(
        (a, b) => SEVERITY_ORDER[b.status] - SEVERITY_ORDER[a.status] || b.date.localeCompare(a.date),
      )[0];
  }, [bundle, filters, modeId, selectedId]);

  const nationalCoverage = useMemo(() => {
    const weeks = bundle.nationalWeekly;
    if (weeks.length === 0) return null;
    let gaps = 0;
    let missingWeeks = 0;
    for (let i = 1; i < weeks.length; i++) {
      const step = daysBetweenIso(weeks[i - 1].periodStart, weeks[i].periodStart) / 7;
      if (step > 1) {
        gaps++;
        missingWeeks += step - 1;
      }
    }
    return {
      count: weeks.length,
      first: weeks[0].periodStart,
      last: weeks[weeks.length - 1].periodEnd,
      gaps,
      missingWeeks,
    };
  }, [bundle.nationalWeekly]);

  const ranked = useMemo(
    () => [...frame.features].sort((a, b) => b.rank - a.rank),
    [frame.features],
  );

  function changeMode(next: MapModeId) {
    setPlaying(false);
    setModeId(next);
  }

  function updateFilter(key: FilterKey, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const filterControls: Record<FilterKey, ReactNode> = {
    disease: (
      <SelectFilter
        key="disease"
        label="Disease/Event"
        value={filters.disease}
        onChange={(v) => updateFilter("disease", v)}
        options={[{ value: "all", label: "All diseases" }, ...diseases.map((d) => ({ value: d, label: d }))]}
      />
    ),
    geography: (
      <SelectFilter
        key="geography"
        label="Geography"
        value={filters.geography}
        onChange={(v) => updateFilter("geography", v)}
        options={[{ value: "all", label: "All areas" }, ...provinces.map((p) => ({ value: p, label: p }))]}
      />
    ),
    status: (
      <SelectFilter
        key="status"
        label="Signal status"
        value={filters.status}
        onChange={(v) => updateFilter("status", v)}
        options={[
          { value: "all", label: "All statuses" },
          { value: "elevated", label: "Elevated" },
          { value: "watch", label: "Watch" },
          { value: "normal", label: "Normal" },
        ]}
      />
    ),
    confidence: (
      <SelectFilter
        key="confidence"
        label="Source confidence"
        value={filters.confidence}
        onChange={(v) => updateFilter("confidence", v)}
        options={[
          { value: "all", label: "All confidence" },
          { value: "high", label: "High confidence" },
          { value: "medium", label: "Medium confidence" },
          { value: "low", label: "Low confidence" },
        ]}
      />
    ),
    medicine: (
      <SelectFilter
        key="medicine"
        label="Medicine (demo)"
        value={filters.medicine}
        onChange={(v) => updateFilter("medicine", v)}
        options={bundle.access.medicines.map((m) => ({ value: m.id, label: m.name }))}
      />
    ),
    accessMetric: (
      <SelectFilter
        key="accessMetric"
        label="Access metric"
        value={filters.accessMetric}
        onChange={(v) => updateFilter("accessMetric", v)}
        options={(Object.keys(ACCESS_METRIC_LABEL) as AccessMetricView[]).map((k) => ({
          value: k,
          label: ACCESS_METRIC_LABEL[k],
        }))}
      />
    ),
    window: (
      <SelectFilter
        key="window"
        label="Time window"
        value={filters.window}
        onChange={(v) => updateFilter("window", v)}
        options={[
          { value: "7", label: "7 days" },
          { value: "14", label: "14 days" },
          { value: "30", label: "30 days" },
          { value: "all", label: "All time" },
        ]}
      />
    ),
  };

  const modeSummary = (
    <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {mode.label} · {slice?.label ?? "No time slice"}
      </p>
      {selectedFeature ? (
        <>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-800">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: rgb(selectedFeature) }} aria-hidden="true" />
            {selectedFeature.classLabel}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {selectedFeature.rows.map((row) => (
              <div key={row.label}>
                <dt className="text-slate-400">{row.label}</dt>
                <dd className="font-medium text-slate-700">{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          No {mode.label.toLowerCase()} layer value for this area at the selected time.
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Analyze"
        title="Signal Explorer"
        subtitle="Explore signals, formal observations, anomalies and scenarios across space and time. Every layer states what kind of evidence it shows."
      />

      {mode.filters.length > 0 && (
        <Card className="flex flex-wrap items-end gap-3 p-4">
          {mode.filters.map((key) => filterControls[key])}
          <Button variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset filters
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          <AnalyticalMap
            modes={MAP_MODES}
            mode={mode}
            onModeChange={changeMode}
            view={view}
            onViewChange={setView}
            toggles={toggles}
            onTogglesChange={(next) => setToggleOverrides((prev) => ({ ...prev, [modeId]: next }))}
            prepared={prepared}
            frame={frame}
            index={index}
            onIndexChange={(next) => setTime({ modeId, index: next })}
            playing={playing}
            onPlayingChange={setPlaying}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </Card>

        <div className="flex flex-col gap-4">
          {mode.id === "access" && selectedId ? (
            <Card className="overflow-hidden">
              <AccessDetailPanel
                bundle={bundle.access}
                lgus={bundle.lgus}
                selectedId={selectedId}
                medicineId={filters.medicine}
                weekIndex={index}
                onClose={() => setSelectedId(undefined)}
              />
            </Card>
          ) : mode.availability === "planned" ? (
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-900">{mode.label}: not connected</p>
              <p className="mt-1 text-sm text-slate-600">{mode.unavailableReason}</p>
              <p className="mt-3 text-xs text-slate-400">
                Nothing is drawn for this mode rather than showing placeholder values.
              </p>
            </Card>
          ) : mode.id === "disease" ? (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">National formal observations</p>
                <EvidenceBadge kind="formal" />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                OpenDengue v1.3 reports dengue for the Philippines at national resolution only.
              </p>
              {nationalCoverage ? (
                <dl className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Weekly records</dt>
                    <dd className="text-right text-slate-700">{formatCount(nationalCoverage.count)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Coverage</dt>
                    <dd className="text-right text-slate-700">
                      {formatIsoDate(nationalCoverage.first)} – {formatIsoDate(nationalCoverage.last)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Gaps in the record</dt>
                    <dd className="text-right text-slate-700">
                      {nationalCoverage.missingWeeks} weeks in {nationalCoverage.gaps} gaps
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-xs text-slate-500">No weekly national records available.</p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Sub-national case maps are not drawn because no sub-national formal data is
                connected. Open-source signals stay in the Signals mode and are never shown as
                case counts.
              </p>
              <Link href="/lab" className="mt-4 block">
                <Button variant="secondary" className="w-full">
                  View full national record in Lab
                </Button>
              </Link>
            </Card>
          ) : selectedLgu && selectedSignal && bundle.trends[selectedLgu.id] ? (
            <Card className="overflow-hidden">
              <LocationDetailPanel
                lgu={selectedLgu}
                signal={selectedSignal}
                trend={bundle.trends[selectedLgu.id]}
                neighbors={bundle.neighbors[selectedLgu.id] ?? []}
                onClose={() => setSelectedId(undefined)}
                summary={modeSummary}
              />
            </Card>
          ) : selectedLgu ? (
            <Card className="overflow-hidden">
              <div className="flex items-start justify-between border-b border-slate-200 p-4">
                <div>
                  <p className="text-[11px] font-medium text-slate-400">{selectedLgu.province}</p>
                  <h3 className="text-base font-semibold text-slate-900">{selectedLgu.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(undefined)}
                  aria-label="Close panel"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {modeSummary}
              <p className="p-4 text-xs text-slate-500">
                No demo signal matches the current filters for this area.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Areas in view</p>
                <p className="text-xs text-slate-500">
                  {slice ? `${slice.label} · ` : ""}
                  {ranked.length} area{ranked.length === 1 ? "" : "s"}. Select one for detail.
                </p>
              </div>
              {ranked.length > 0 ? (
                <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
                  {ranked.map((feature) => (
                    <li key={feature.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(feature.id)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: rgb(feature) }}
                          aria-hidden="true"
                        />
                        <span className="flex-1 text-sm text-slate-700">{feature.name}</span>
                        <span className="text-xs text-slate-500">{feature.classLabel}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-6 text-center text-xs text-slate-400">
                  No areas match the current filters at this time.
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
