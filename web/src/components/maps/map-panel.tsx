"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MaplibreMap, Marker, NavigationControl, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { resolveBasemap } from "@/lib/map/basemap";
import { STATUS_HEX } from "@/lib/map/palette";
import { SIGNAL_STATUS_CONFIG } from "@/lib/status";
import { cn } from "@/lib/utils";
import { MapFallback } from "./map-fallback";
import type { MapPanelProps } from "./types";

export type { MapMarkerData, MapPanelProps } from "./types";

/** Shared resolver: MapTiler when NEXT_PUBLIC_MAPTILER_KEY is set, key-less OSM raster otherwise. */
const BASEMAP = resolveBasemap();

export function MapPanel({
  markers,
  selectedId,
  onSelect,
  center = [121.05, 14.6],
  zoom = 10.2,
  heightClassName = "h-80",
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRefs = useRef<Map<string, Marker>>(new Map());
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let map: MaplibreMap;
    try {
      map = new MaplibreMap({
        container: containerRef.current,
        style: BASEMAP.style,
        center,
        zoom,
        attributionControl: { compact: true },
      });
      map.addControl(
        new NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.on("load", () => setReady(true));
      mapRef.current = map;
    } catch {
      // Defer: notifying React of an init failure from inside this effect's
      // own synchronous body is what react-hooks/set-state-in-effect flags.
      setTimeout(() => setFailed(true), 0);
      return;
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Map instance is created once; center/zoom are initial values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current.clear();

    markers.forEach((markerData) => {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute(
        "aria-label",
        `${markerData.label}: ${SIGNAL_STATUS_CONFIG[markerData.status].label}`,
      );
      const isSelected = markerData.id === selectedId;
      const size = markerData.status === "elevated" ? 16 : 12;
      Object.assign(el.style, {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "9999px",
        background: STATUS_HEX[markerData.status],
        border: isSelected ? "3px solid #0f172a" : "2px solid white",
        boxShadow: "0 1px 3px rgba(15,23,42,0.35)",
        cursor: "pointer",
        padding: "0",
      });

      const popup = new Popup({
        offset: 12,
        closeButton: false,
        closeOnClick: false,
      }).setHTML(
        `<div style="font:500 12px system-ui;color:#0f172a;">${markerData.label}${
          markerData.sublabel
            ? `<div style="font-weight:400;color:#64748b;margin-top:2px;">${markerData.sublabel}</div>`
            : ""
        }</div>`,
      );

      el.addEventListener("mouseenter", () => {
        popup.setLngLat([markerData.longitude, markerData.latitude]).addTo(map);
      });
      el.addEventListener("mouseleave", () => popup.remove());
      el.addEventListener("click", () => onSelect?.(markerData.id));

      const marker = new Marker({ element: el })
        .setLngLat([markerData.longitude, markerData.latitude])
        .addTo(map);
      markerRefs.current.set(markerData.id, marker);
    });
  }, [markers, selectedId, onSelect, ready]);

  if (failed) {
    return (
      <MapFallback
        markers={markers}
        selectedId={selectedId}
        onSelect={onSelect}
        heightClassName={heightClassName}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-slate-200",
        heightClassName,
      )}
    >
      <div
        ref={containerRef}
        className={cn("sigma-map h-full w-full", BASEMAP.isRaster && "sigma-map--raster")}
      />
    </div>
  );
}
