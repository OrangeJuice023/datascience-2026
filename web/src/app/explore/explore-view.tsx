"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SelectFilter } from "@/components/ui/select-filter";
import { Button } from "@/components/ui/button";
import { AnalyticalMap } from "@/components/maps/analytical/analytical-map";
import { LocationDetailPanel } from "@/components/maps/location-detail-panel";
import { SigmaDetailPanel } from "@/components/maps/sigma-detail-panel";
import { EnvironmentDetailPanel } from "@/components/maps/environment-detail-panel";
import {
  WEATHER_SOURCE_LABEL,
  WEATHER_VARIABLE_META,
  type EnvironmentBundle,
} from "@/lib/environment/bundle";
import type { WeatherSourceId, WeatherVariable } from "@/types/data";
import { SIGMA_DATA_URL, type SigmaData } from "@/lib/sigma/data";
import { AccessDetailPanel } from "@/components/access/access-detail-panel";
import { ACCESS_METRIC_LABEL, type AccessMetricView } from "@/lib/access/bundle";
import { MAP_MODES, getMapMode } from "@/lib/map/modes";
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
import { neighborKey } from "@/lib/neighbors";
import { daysBetweenIso, formatCount, formatIsoDate } from "@/lib/map/format";
import { EvidenceBadge } from "@/components/ui/evidence-badge";

const DEFAULT_FILTERS: MapFilters = {
  medicine: "oral-rehydration-salts",
  accessMetric: "gap",
  sigmaLayer: "ears",
  envVariable: "precipitation_mm",
  envSource: "cchain",
};

const EMPTY_FRAME: ModeFrame = { features: [], links: [] };
const BASE_TOGGLES: MapLayerToggles = { links: false, columns: true, areas: false };

function rgb(feature: MapFeature) {
  return `rgb(${feature.color[0]} ${feature.color[1]} ${feature.color[2]})`;
}

export function ExploreView({ bundle }: { bundle: MapDataBundle }) {
  const [modeId, setModeId] = useState<MapModeId>("sigma");
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<MapViewMode>("2d");
  const [toggleOverrides, setToggleOverrides] = useState<Partial<Record<MapModeId, MapLayerToggles>>>({});
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [playing, setPlaying] = useState(false);
  // The timeline position belongs to one mode; switching modes starts at that mode's latest slice.
  const [time, setTime] = useState<{ modeId: MapModeId; index: number } | null>(null);
  // SIGMA is the default mode, so its results (~1 MB) are fetched on first render.
  const [sigma, setSigma] = useState<{ data?: SigmaData; error?: string }>({});

  useEffect(() => {
    fetch(SIGMA_DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SigmaData>;
      })
      .then((data) => setSigma({ data }))
      .catch((error: unknown) =>
        setSigma({ error: error instanceof Error ? error.message : "unknown error" }),
      );
  }, []);

  // City weather (~0.9 MB) is a separate chunk, imported only when the mode is first opened.
  const [environment, setEnvironment] = useState<{ data?: EnvironmentBundle; error?: string; requested: boolean }>({
    requested: false,
  });

  function loadEnvironment() {
    if (environment.requested) return;
    setEnvironment({ requested: true });
    import("@/data/environment-weekly.json")
      .then((mod) => setEnvironment({ data: mod.default as unknown as EnvironmentBundle, requested: true }))
      .catch((error: unknown) =>
        setEnvironment({ error: error instanceof Error ? error.message : "unknown error", requested: true }),
      );
  }

  const modeBundle = useMemo(
    () => ({
      ...bundle,
      ...(sigma.data || sigma.error ? { sigma: sigma.data, sigmaError: sigma.error } : {}),
      ...(environment.data || environment.error
        ? { environment: environment.data, environmentError: environment.error }
        : {}),
    }),
    [bundle, sigma.data, sigma.error, environment.data, environment.error],
  );

  const mode = getMapMode(modeId);
  const toggles = useMemo(
    () => toggleOverrides[modeId] ?? { ...BASE_TOGGLES, ...mode.defaultToggles },
    [toggleOverrides, modeId, mode],
  );
  const prepared = useMemo(() => mode.prepare?.(modeBundle, filters) ?? null, [mode, modeBundle, filters]);
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
    return bundle.signals
      .filter((s) => s.locationId === selectedId)
      .sort(
        (a, b) => SEVERITY_ORDER[b.status] - SEVERITY_ORDER[a.status] || b.date.localeCompare(a.date),
      )[0];
  }, [bundle, selectedId]);

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
    if (next === "environment") loadEnvironment();
    setPlaying(false);
    setModeId(next);
  }

  function updateFilter(key: FilterKey, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    // The two weather sources have different calendars, so a slice index means a different week.
    if (key === "envSource") setTime(null);
  }

  // Filters change what the timeline means (e.g. the weather source's calendar),
  // so a reset also returns the timeline to the latest slice and stops playback.
  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setTime(null);
    setPlaying(false);
  }

  const filterControls: Record<FilterKey, ReactNode> = {
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
    sigmaLayer: (
      <SelectFilter
        key="sigmaLayer"
        label="SIGMA layer"
        value={filters.sigmaLayer}
        onChange={(v) => updateFilter("sigmaLayer", v)}
        options={[
          { value: "ears", label: "EARS signal" },
          { value: "doh", label: "DOH threshold" },
          { value: "cases", label: "Reported cases" },
        ]}
      />
    ),
    envVariable: (
      <SelectFilter
        key="envVariable"
        label="Weather variable"
        value={filters.envVariable}
        onChange={(v) => updateFilter("envVariable", v)}
        options={(Object.keys(WEATHER_VARIABLE_META) as WeatherVariable[]).map((v) => ({
          value: v,
          label: `${WEATHER_VARIABLE_META[v].label} (${WEATHER_VARIABLE_META[v].unit})`,
        }))}
      />
    ),
    envSource: (
      <SelectFilter
        key="envSource"
        label="Weather source"
        value={filters.envSource}
        onChange={(v) => updateFilter("envSource", v)}
        options={(Object.keys(WEATHER_SOURCE_LABEL) as WeatherSourceId[]).map((s) => ({
          value: s,
          label: s === "cchain" ? `${WEATHER_SOURCE_LABEL[s]} (2003–2022)` : `${WEATHER_SOURCE_LABEL[s]} (2008–present)`,
        }))}
      />
    ),
  };

  const modeSummary = (
    <div className="border-b border-rule bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">
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
                <dt className="text-slate-500">{row.label}</dt>
                <dd className="font-medium tabular-nums text-slate-800">{row.value}</dd>
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
        title="Signal Explorer"
        subtitle="Explore formal observations, EARS and DOH threshold results, weather and access across space and time. Every layer states what kind of evidence it shows."
      />

      {mode.filters.length > 0 && (
        <div
          role="group"
          aria-label={`${mode.label} filters`}
          className="flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] bg-slate-50 p-3 sm:px-4"
        >
          {mode.filters.map((key) => filterControls[key])}
          <Button variant="ghost" onClick={resetFilters} className="min-h-10 md:min-h-9">
            Reset filters
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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

        <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">
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
              <h2 className="text-sm font-semibold text-ink">{mode.label}: not connected</h2>
              <p className="mt-1 text-sm text-slate-600">{mode.unavailableReason}</p>
              <p className="mt-3 text-xs text-slate-500">
                Nothing is drawn for this mode rather than showing placeholder values.
              </p>
            </Card>
          ) : mode.id === "disease" ? (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink">National formal observations</h2>
                <EvidenceBadge kind="formal" />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                OpenDengue v1.3 reports dengue for the Philippines at national resolution only.
              </p>
              {nationalCoverage ? (
                <dl className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Weekly records</dt>
                    <dd className="text-right tabular-nums text-slate-800">{formatCount(nationalCoverage.count)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Coverage</dt>
                    <dd className="text-right tabular-nums text-slate-800">
                      {formatIsoDate(nationalCoverage.first)} – {formatIsoDate(nationalCoverage.last)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Gaps in the record</dt>
                    <dd className="text-right tabular-nums text-slate-800">
                      {nationalCoverage.missingWeeks} weeks in {nationalCoverage.gaps} gaps
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-xs text-slate-500">No weekly national records available.</p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Sub-national case maps are not drawn because no sub-national formal data is
                connected here. Reporting-unit results are in the SIGMA mode, and open-source
                signals are never shown as case counts.
              </p>
              <Link href="/lab" className="mt-4 block">
                <Button variant="secondary" className="w-full">
                  View full national record in Lab
                </Button>
              </Link>
            </Card>
          ) : mode.id === "sigma" && selectedId && sigma.data?.units.some((u) => u.id === selectedId) ? (
            <Card className="overflow-hidden">
              <SigmaDetailPanel
                data={sigma.data}
                unitId={selectedId}
                week={slice?.key}
                onClose={() => setSelectedId(undefined)}
              />
            </Card>
          ) : mode.id === "environment" &&
            selectedId &&
            environment.data?.geographies.some((g) => g.id === selectedId) ? (
            <Card className="overflow-hidden">
              <EnvironmentDetailPanel
                data={environment.data}
                geographyId={selectedId}
                variable={filters.envVariable}
                week={slice?.key}
                onClose={() => setSelectedId(undefined)}
              />
            </Card>
          ) : selectedLgu && selectedSignal && bundle.trends[selectedLgu.id] ? (
            <Card className="overflow-hidden">
              <LocationDetailPanel
                lgu={selectedLgu}
                signal={selectedSignal}
                trend={bundle.trends[selectedLgu.id]}
                neighbors={bundle.neighbors[neighborKey(selectedSignal.disease, selectedLgu.id)] ?? []}
                onClose={() => setSelectedId(undefined)}
                summary={modeSummary}
              />
            </Card>
          ) : selectedLgu ? (
            <Card className="overflow-hidden">
              <div className="flex items-start justify-between border-b border-slate-200 p-4">
                <div>
                  <p className="text-xs text-slate-500">{selectedLgu.province}</p>
                  <h2 className="text-base font-semibold text-ink">{selectedLgu.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(undefined)}
                  aria-label="Close panel"
                  className="-mr-1 -mt-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink"
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
              <div className="border-b border-rule px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">Areas in view</h2>
                <p className="text-xs text-slate-500">
                  {slice ? `${slice.label} · ` : ""}
                  {ranked.length} area{ranked.length === 1 ? "" : "s"}. Select one for detail.
                </p>
              </div>
              {ranked.length > 0 ? (
                <ul className="max-h-[28rem] divide-y divide-rule overflow-y-auto xl:max-h-[calc(100vh-9rem)]">
                  {ranked.map((feature) => (
                    <li key={feature.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(feature.id)}
                        className="flex min-h-11 w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50 focus-visible:bg-slate-50"
                      >
                        <span
                          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: rgb(feature) }}
                          aria-hidden="true"
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm text-ink">{feature.name}</span>
                          <span className="text-xs text-slate-500">{feature.classLabel}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-6 text-center text-[13px] text-slate-500">
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
