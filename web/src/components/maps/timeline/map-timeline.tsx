"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { TimelineSpec } from "@/lib/map/types";
import { cn } from "@/lib/utils";

const TRACK_HEIGHT = 36;

/** Aim for roughly a ten-second pass regardless of slice count. */
function playbackInterval(length: number): number {
  return Math.min(650, Math.max(110, Math.round(10_000 / Math.max(length, 1))));
}

export function MapTimeline({
  spec,
  index,
  onIndexChange,
  playing,
  onPlayingChange,
}: {
  spec: TimelineSpec;
  index: number;
  onIndexChange: (index: number) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
}) {
  const { slices } = spec;
  const last = slices.length - 1;
  const current = slices[Math.min(index, last)];
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const indexRef = useRef(index);
  const callbacksRef = useRef({ onIndexChange, onPlayingChange });

  useEffect(() => {
    indexRef.current = index;
    callbacksRef.current = { onIndexChange, onPlayingChange };
  });

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = indexRef.current + 1;
      if (next > last) {
        callbacksRef.current.onPlayingChange(false);
        return;
      }
      callbacksRef.current.onIndexChange(next);
    }, playbackInterval(slices.length));
    return () => clearInterval(id);
  }, [playing, last, slices.length]);

  if (!current) {
    return <p className="text-xs text-slate-400">No time slices available for this mode.</p>;
  }

  const max = Math.max(...slices.map((s) => s.value), 1);
  const hovered = hoverIndex === null ? null : slices[hoverIndex];
  const cursorPct = last > 0 ? (index / last) * 100 : 0;

  function togglePlay() {
    if (playing) {
      onPlayingChange(false);
      return;
    }
    if (index >= last) onIndexChange(0);
    onPlayingChange(true);
  }

  function step(delta: number) {
    onPlayingChange(false);
    onIndexChange(Math.min(last, Math.max(0, index + delta)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-1" role="group" aria-label="Timeline playback">
          <TimelineButton label="Previous step" onClick={() => step(-1)} disabled={index <= 0}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </TimelineButton>
          <TimelineButton
            label={playing ? "Pause playback" : "Play timeline"}
            onClick={togglePlay}
            pressed={playing}
            primary
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
          </TimelineButton>
          <TimelineButton label="Next step" onClick={() => step(1)} disabled={index >= last}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </TimelineButton>
        </div>
        <p className="min-w-0 text-sm text-slate-800" aria-live={playing ? "off" : "polite"}>
          <span className="font-semibold">{current.label}</span>
          <span className="text-slate-400"> · </span>
          <span className="tabular-nums text-slate-600">{spec.formatValue(current.value)}</span>
        </p>
        <p className="ml-auto hidden text-[11px] text-slate-400 lg:block">{spec.trackLabel}</p>
      </div>

      <div className="relative rounded-md focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2">
        <svg
          viewBox={`0 0 ${slices.length} ${TRACK_HEIGHT}`}
          preserveAspectRatio="none"
          className="block h-9 w-full"
          aria-hidden="true"
        >
          <line x1={0} x2={slices.length} y1={TRACK_HEIGHT - 0.25} y2={TRACK_HEIGHT - 0.25} stroke="#e2e8f0" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
          {slices.map((slice, i) => {
            const h = Math.max(slice.value > 0 ? 2 : 0, (slice.value / max) * (TRACK_HEIGHT - 4));
            return (
              <g key={slice.key}>
                {slice.gapBefore && (
                  <line x1={i} x2={i} y1={0} y2={TRACK_HEIGHT} stroke="#94a3b8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                )}
                <rect
                  x={i + 0.12}
                  y={TRACK_HEIGHT - h}
                  width={0.76}
                  height={h}
                  fill={i === index ? "#0d9488" : i === hoverIndex ? "#64748b" : i < index ? "#94a3b8" : "#cbd5e1"}
                />
              </g>
            );
          })}
        </svg>
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-slate-900"
          style={{ left: `${((index + 0.5) / slices.length) * 100}%` }}
          aria-hidden="true"
        />
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={index}
          aria-label="Timeline position"
          aria-valuetext={`${current.label}, ${spec.formatValue(current.value)}`}
          onChange={(event) => {
            onPlayingChange(false);
            onIndexChange(Number(event.target.value));
          }}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            setHoverIndex(Math.min(last, Math.max(0, Math.floor(ratio * slices.length))));
          }}
          onPointerLeave={() => setHoverIndex(null)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        {hovered && hoverIndex !== null && hoverIndex !== index && (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-sm"
            style={{ left: `${((hoverIndex + 0.5) / slices.length) * 100}%` }}
          >
            <span className="font-medium text-slate-700">{hovered.label}</span>
            <span className="text-slate-400"> · </span>
            <span className="tabular-nums text-slate-600">{spec.formatValue(hovered.value)}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between text-[11px] tabular-nums text-slate-400">
        <span>{slices[0].shortLabel}</span>
        <span className="sr-only">Position {Math.round(cursorPct)}%</span>
        <span>{slices[last].shortLabel}</span>
      </div>
      <p className="text-[11px] leading-snug text-slate-500">{spec.interpretation}</p>
    </div>
  );
}

function TimelineButton({
  label,
  onClick,
  disabled,
  pressed,
  primary,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        primary
          ? "bg-slate-900 text-white hover:bg-slate-800"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}
