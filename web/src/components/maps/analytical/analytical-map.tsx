"use client";

import { useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { Box, ChevronDown, ChevronUp, Globe2, Map as MapIcon, RotateCcw } from "lucide-react";
import { resolveBasemap, type ResolvedBasemap } from "@/lib/map/basemap";
import type {
  LayerToggleId,
  MapLayerToggles,
  MapModeDefinition,
  MapModeId,
  MapViewMode,
  ModeFrame,
  PreparedMode,
} from "@/lib/map/types";
import { cn } from "@/lib/utils";
import { EVIDENCE_KIND } from "@/lib/map/modes";
import { EVIDENCE_CONFIG, EvidenceBadge } from "@/components/ui/evidence-badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AnalyticalLegend } from "../legend/analytical-legend";
import { MapTimeline } from "../timeline/map-timeline";
import type { MapHover } from "./map-canvas";

const MapCanvas = dynamic(() => import("./map-canvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-xs text-slate-400">
      Loading map engine…
    </div>
  ),
});

/** Build-time env only, so this is identical on server and client. */
const INITIAL_BASEMAP = resolveBasemap();

const VIEWS: Array<{ id: MapViewMode; label: string; icon: typeof MapIcon }> = [
  { id: "2d", label: "2D", icon: MapIcon },
  { id: "3d", label: "3D", icon: Box },
  { id: "globe", label: "Globe", icon: Globe2 },
];

const AVAILABILITY_BADGE: Record<MapModeDefinition["availability"], { label: string; className: string }> = {
  demo: { label: "Demo", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  observed: { label: "Observed", className: "bg-teal-50 text-teal-700 ring-teal-200" },
  planned: { label: "Planned", className: "bg-slate-100 text-slate-500 ring-slate-200" },
};

const TOGGLE_LABEL: Record<MapModeId, Partial<Record<LayerToggleId, string>>> = {
  cases: {},
  ears: { areas: "Area fills" },
  doh: { areas: "Area fills" },
  environment: {},
  access: { areas: "Area fills", columns: "3D columns" },
};

export interface AnalyticalMapProps {
  modes: MapModeDefinition[];
  mode: MapModeDefinition;
  onModeChange: (id: MapModeId) => void;
  view: MapViewMode;
  onViewChange: (view: MapViewMode) => void;
  toggles: MapLayerToggles;
  onTogglesChange: (toggles: MapLayerToggles) => void;
  prepared: PreparedMode | null;
  frame: ModeFrame;
  index: number;
  onIndexChange: (index: number) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  heightClassName?: string;
  /** Hide the mode tabs, e.g. on a page dedicated to one mode. */
  hideModeTabs?: boolean;
}

export function AnalyticalMap({
  modes,
  mode,
  onModeChange,
  view,
  onViewChange,
  toggles,
  onTogglesChange,
  prepared,
  frame,
  index,
  onIndexChange,
  playing,
  onPlayingChange,
  selectedId,
  onSelect,
  heightClassName = "h-[60vh] min-h-[22rem] lg:h-[34rem]",
  hideModeTabs = false,
}: AnalyticalMapProps) {
  const [basemap, setBasemap] = useState<ResolvedBasemap>(INITIAL_BASEMAP);
  const [issue, setIssue] = useState<string | null>(null);
  const [hover, setHover] = useState<MapHover | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [legendOpen, setLegendOpen] = useState(true);

  const hovered = hover ? frame.features.find((f) => f.id === hover.id) : undefined;
  const columnsOnScreen = view === "3d" && toggles.columns && mode.layerToggles.includes("columns");

  return (
    <div className="flex flex-col">
      {/* Modes */}
      <div className={cn("border-b border-rule px-3 py-3 sm:px-4", hideModeTabs && "hidden")}>
        <SegmentedControl
          ariaLabel="Map mode"
          phoneGrid
          value={mode.id}
          onChange={onModeChange}
          items={modes.map((m) => {
            const evidence = EVIDENCE_CONFIG[EVIDENCE_KIND[m.evidence]];
            return {
              id: m.id,
              label: m.label,
              title: m.unavailableReason ?? m.question,
              srLabel: `(${evidence.label} evidence)`,
              leading: <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", evidence.dotClass)} aria-hidden="true" />,
              trailing:
                m.availability === "planned" ? (
                  <span className="rounded bg-slate-100 px-1 text-xs font-medium text-slate-600">Planned</span>
                ) : undefined,
            };
          })}
        />
      </div>

      {/* Mode context, layers and view */}
      <div className="flex flex-col gap-3 px-3 pt-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <EvidenceBadge kind={EVIDENCE_KIND[mode.evidence]} />
          <span
            className={cn(
              "inline-flex flex-none items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ring-1",
              AVAILABILITY_BADGE[mode.availability].className,
            )}
          >
            {AVAILABILITY_BADGE[mode.availability].label}
          </span>
          <p className="w-full text-sm font-medium text-ink">{mode.question}</p>
          <p className="w-full text-xs text-slate-500">{mode.evidenceLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {mode.layerToggles.length > 0 && (
            <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Layers">
              {mode.layerToggles.map((id) => {
                const needs3d = id === "columns" && view !== "3d";
                return (
                  <label
                    key={id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 text-[13px] sm:min-h-8",
                      needs3d ? "cursor-not-allowed text-slate-500" : "text-slate-700",
                    )}
                    title={needs3d ? "Switch to 3D to see extrusion" : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={toggles[id]}
                      disabled={needs3d}
                      onChange={(event) => onTogglesChange({ ...toggles, [id]: event.target.checked })}
                      className="h-4 w-4 accent-[var(--ink)]"
                    />
                    {TOGGLE_LABEL[mode.id][id]}
                    {needs3d && <span className="text-xs">(3D)</span>}
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <SegmentedControl
              ariaLabel="Map view"
              size="sm"
              className="shrink-0 flex-nowrap"
              value={view}
              onChange={onViewChange}
              items={VIEWS.map(({ id, label, icon: Icon }) => ({
                id,
                label,
                leading: <Icon className="h-3.5 w-3.5" aria-hidden="true" />,
              }))}
            />
            <button
              type="button"
              onClick={() => setResetToken((t) => t + 1)}
              className="flex h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-control bg-sheet px-3 text-[13px] font-medium text-slate-700 hover:bg-raised sm:h-9"
              title="Reset view"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Reset</span>
              <span className="sr-only sm:hidden">Reset view</span>
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="p-3 sm:p-4">
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-[#e8ecef]",
            heightClassName,
          )}
          onPointerLeave={() => setHover(null)}
        >
          <MapCanvas
            frame={frame}
            view={view}
            extent={mode.extent}
            toggles={toggles}
            selectedId={selectedId}
            hoveredId={hover?.id}
            resetToken={resetToken}
            basemap={INITIAL_BASEMAP}
            onHover={setHover}
            onSelect={(id) => onSelect(id ?? undefined)}
            onStatus={(next, message) => {
              setBasemap(next);
              setIssue(message);
            }}
          />

          {hovered && hover && (
            <MapTooltip
              x={hover.x}
              y={hover.y}
              title={hovered.name}
              subtitle={hovered.classLabel}
              rows={hovered.rows.slice(0, 3)}
            />
          )}

          {frame.national && (
            <div className="absolute left-3 top-3 w-64 max-w-[calc(100%-4.5rem)] rounded-[var(--radius-card)] border border-border bg-sheet p-3 shadow-[0_4px_16px_rgba(34,35,31,0.08)]">
              <p className="text-xs font-medium text-slate-500">
                {frame.national.title}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{frame.national.value}</p>
              <p className="text-xs text-slate-500">{frame.national.period}</p>
              <dl className="mt-2 space-y-0.5 border-t border-rule pt-2 text-xs">
                {frame.national.rows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-2">
                    <dt className="text-slate-500">{row.label}</dt>
                    <dd className="text-right tabular-nums text-slate-700">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {mode.availability === "planned" && (
            <div className="absolute inset-0 flex items-center justify-center bg-sheet/70 p-6">
              <div className="max-w-sm rounded-[var(--radius-card)] border border-border bg-sheet p-4 text-center shadow-[0_4px_16px_rgba(34,35,31,0.08)]">
                <p className="text-sm font-semibold text-slate-800">{mode.label} layer not connected</p>
                <p className="mt-1 text-xs text-slate-500">{mode.unavailableReason}</p>
              </div>
            </div>
          )}

          {prepared &&
            (legendOpen ? (
              <div className="absolute bottom-3 left-3 hidden w-72 max-w-[calc(100%-1.5rem)] rounded-[var(--radius-card)] border border-border bg-sheet p-3 pr-2 shadow-[0_4px_16px_rgba(34,35,31,0.08)] md:block">
                <button
                  type="button"
                  onClick={() => setLegendOpen(false)}
                  aria-label="Hide legend"
                  title="Hide legend"
                  className="absolute right-1.5 top-1.5 rounded-[var(--radius-control)] p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink"
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <AnalyticalLegend spec={prepared.legend} showHeight={columnsOnScreen} className="pr-6" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLegendOpen(true)}
                className="absolute bottom-3 left-3 hidden h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-sheet px-3 text-[13px] font-medium text-slate-700 shadow-[0_4px_16px_rgba(34,35,31,0.08)] hover:text-ink md:flex"
              >
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                Legend · {prepared.legend.title}
              </button>
            ))}
        </div>

        {prepared && (
          <div className="mt-3 rounded-[var(--radius-card)] border border-border p-3 md:hidden">
            <AnalyticalLegend spec={prepared.legend} showHeight={columnsOnScreen} />
          </div>
        )}

        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Basemap: {basemap.label}
          {basemap.provider === "osm-fallback" &&
            !issue &&
            " · set NEXT_PUBLIC_MAPTILER_KEY for the vector basemap and 3D terrain"}
          {issue && <span className="text-amber-700"> · {issue}</span>}
        </p>
      </div>

      {prepared && prepared.timeline.slices.length > 0 && (
        <div className="border-t border-rule p-3 sm:p-4">
          <MapTimeline
            spec={prepared.timeline}
            index={index}
            onIndexChange={onIndexChange}
            playing={playing}
            onPlayingChange={onPlayingChange}
          />
        </div>
      )}
    </div>
  );
}

function MapTooltip({
  x,
  y,
  title,
  subtitle,
  rows,
}: {
  x: number;
  y: number;
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: string }>;
}) {
  // Flip toward the map interior so the card never clips at the edges.
  const style: CSSProperties = {
    left: x,
    top: y,
    transform: `translate(${x > 220 ? "calc(-100% - 12px)" : "12px"}, ${y > 160 ? "calc(-100% - 12px)" : "12px"})`,
  };
  return (
    <div
      className="pointer-events-none absolute z-10 w-60 rounded-[var(--radius-control)] border border-border bg-sheet px-3 py-2 text-xs shadow-[0_6px_20px_rgba(34,35,31,0.12)]"
      style={style}
      role="tooltip"
    >
      <p className="font-semibold text-ink">{title}</p>
      <p className="text-slate-500">{subtitle}</p>
      <dl className="mt-1.5 space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2">
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="text-right font-medium tabular-nums text-slate-700">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-slate-500">Click to open details</p>
    </div>
  );
}
