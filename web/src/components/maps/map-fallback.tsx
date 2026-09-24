"use client";

import { SIGNAL_STATUS_CONFIG } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { MapPanelProps } from "./types";

const BOUNDS = { minLat: 14.35, maxLat: 14.75, minLng: 120.9, maxLng: 121.25 };

function project(lat: number, lng: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = (1 - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return { x: Math.min(96, Math.max(4, x)), y: Math.min(96, Math.max(4, y)) };
}

/** Graceful fallback used when the MapLibre canvas cannot initialize (e.g. no WebGL). */
export function MapFallback({
  markers,
  selectedId,
  onSelect,
  heightClassName = "h-80",
}: MapPanelProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50",
        heightClassName,
      )}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <p className="absolute left-3 top-3 max-w-[70%] text-[11px] font-medium text-slate-400">
        Map tiles unavailable — showing schematic layout
      </p>
      {markers.map((marker) => {
        const { x, y } = project(marker.latitude, marker.longitude);
        const config = SIGNAL_STATUS_CONFIG[marker.status];
        const isSelected = marker.id === selectedId;
        return (
          <button
            key={marker.id}
            type="button"
            onClick={() => onSelect?.(marker.id)}
            style={{ left: `${x}%`, top: `${y}%`, background: marker.color }}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition-transform hover:scale-110",
              !marker.color && config.dotClass,
              isSelected ? "h-4 w-4 ring-slate-900" : "h-3 w-3",
            )}
            aria-label={`${marker.label}: ${marker.color ? (marker.sublabel ?? "") : config.label}`}
            title={marker.label}
          />
        );
      })}
    </div>
  );
}
