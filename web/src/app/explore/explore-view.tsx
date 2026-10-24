"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SelectFilter } from "@/components/ui/select-filter";
import { Button } from "@/components/ui/button";
import { AnalyticalMap } from "@/components/maps/analytical/analytical-map";
import { SigmaDetailPanel } from "@/components/maps/sigma-detail-panel";
import { EnvironmentDetailPanel } from "@/components/maps/environment-detail-panel";
import {
  WEATHER_SOURCE_LABEL,
  WEATHER_VARIABLE_META,
  type EnvironmentBundle,
} from "@/lib/environment/bundle";
import type { WeatherSourceId, WeatherVariable } from "@/types/data";
import { SIGMA_DATA_URL, type SigmaData } from "@/lib/sigma/data";
import { MAP_MODES, getMapMode } from "@/lib/map/modes";
import { isSigmaView } from "@/lib/map/modes/sigma";
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

const DEFAULT_FILTERS: MapFilters = {
  facilityType: "pharmacy",
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
  const [modeId, setModeId] = useState<MapModeId>("ears");
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<MapViewMode>("2d");
  const [toggleOverrides, setToggleOverrides] = useState<Partial<Record<MapModeId, MapLayerToggles>>>({});
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [playing, setPlaying] = useState(false);
  // The timeline position belongs to one mode; switching modes starts at that mode's latest slice.
  const [time, setTime] = useState<{ modeId: MapModeId; index: number } | null>(null);
  // The EARS view opens first, so the SIGMA results (~1 MB) are fetched on first render.
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

  // Only the filters a current view uses; the SIGMA views have none.
  const filterControls: Partial<Record<FilterKey, ReactNode>> = {
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


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Signal Explorer"
        subtitle="Explore formal observations, EARS and DOH threshold results, weather and access across space and time. Every layer states what kind of evidence it shows."
      />

      {mode.filters.length > 0 && (
        <Card className="flex flex-wrap items-end gap-3 p-4">
          {mode.filters.map((key) => filterControls[key])}
          <Button variant="ghost" onClick={resetFilters}>
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
          {mode.availability === "planned" ? (
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-900">{mode.label}: not connected</p>
              <p className="mt-1 text-sm text-slate-600">{mode.unavailableReason}</p>
              <p className="mt-3 text-xs text-slate-400">
                Nothing is drawn for this mode rather than showing placeholder values.
              </p>
            </Card>
          ) : isSigmaView(mode.id) && selectedId && sigma.data?.units.some((u) => u.id === selectedId) ? (
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
