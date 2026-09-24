"use client";

import { useEffect, useRef, useState } from "react";
import {
  LngLat,
  Map as MaplibreMap,
  NavigationControl,
  ScaleControl,
  type ErrorEvent as MaplibreErrorEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ArcLayer, ColumnLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import { FALLBACK_BASEMAP, type ResolvedBasemap } from "@/lib/map/basemap";
import { EXTENT_BOUNDS, GLOBE_CAMERA, VIEW_CAMERA } from "@/lib/map/geo";
import type {
  MapExtent,
  MapFeature,
  MapLayerToggles,
  MapViewMode,
  ModeFrame,
} from "@/lib/map/types";
import { cn } from "@/lib/utils";
import { MapFallback } from "../map-fallback";

export interface MapHover {
  id: string;
  x: number;
  y: number;
}

export interface MapCanvasProps {
  frame: ModeFrame;
  view: MapViewMode;
  extent: MapExtent;
  toggles: MapLayerToggles;
  selectedId?: string;
  hoveredId?: string;
  /** Increment to fly back to the default camera for the current mode/view. */
  resetToken: number;
  basemap: ResolvedBasemap;
  onHover: (hover: MapHover | null) => void;
  onSelect: (id: string | null) => void;
  /** Reports the basemap actually in use and any degradation worth showing. */
  onStatus?: (basemap: ResolvedBasemap, issue: string | null) => void;
}

const TERRAIN_SOURCE = "sigma-terrain";
/** Full column height in meters at the metro extent. */
const MAX_COLUMN_METERS = 5200;
const CAMERA_DURATION = 900;

type Camera = { center: [number, number]; zoom: number; pitch: number; bearing: number };

function cameraFor(map: MaplibreMap, extent: MapExtent, view: MapViewMode): Camera {
  if (view === "globe") return { ...GLOBE_CAMERA, pitch: 0, bearing: 0 };
  const fit = map.cameraForBounds(EXTENT_BOUNDS[extent], { padding: 36 });
  const center = fit?.center ? LngLat.convert(fit.center) : map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: fit?.zoom ?? map.getZoom(),
    ...VIEW_CAMERA[view],
  };
}

function applyProjection(map: MaplibreMap, view: MapViewMode, hasTerrain: boolean) {
  map.setProjection({ type: view === "globe" ? "globe" : "mercator" });
  if (hasTerrain) {
    map.setTerrain(view === "3d" ? { source: TERRAIN_SOURCE, exaggeration: 1.3 } : null);
  }
}

function buildLayers(
  frame: ModeFrame,
  view: MapViewMode,
  toggles: MapLayerToggles,
  selectedId: string | undefined,
  hoveredId: string | undefined,
) {
  const columnIds = new Set(
    view === "3d" && toggles.columns
      ? frame.features.filter((f) => (f.elevation ?? 0) > 0.02).map((f) => f.id)
      : [],
  );
  const columns = frame.features.filter((f) => columnIds.has(f.id));
  const points = frame.features.filter((f) => !columnIds.has(f.id));
  const focused = frame.features.filter((f) => f.id === selectedId || f.id === hoveredId);

  return [
    toggles.links &&
      frame.links.length > 0 &&
      new ArcLayer<ModeFrame["links"][number]>({
        id: "links",
        data: frame.links,
        getSourcePosition: (d) => d.from,
        getTargetPosition: (d) => d.to,
        getSourceColor: (d) => d.color,
        getTargetColor: (d) => d.color,
        getWidth: 1.5,
        widthUnits: "pixels",
        getHeight: view === "3d" ? 0.35 : 0,
        greatCircle: view === "globe",
      }),
    columns.length > 0 &&
      new ColumnLayer<MapFeature>({
        id: "columns",
        data: columns,
        diskResolution: 24,
        radius: 420,
        extruded: true,
        pickable: true,
        getPosition: (d) => d.position,
        getElevation: (d) => (d.elevation ?? 0) * MAX_COLUMN_METERS,
        getFillColor: (d) => d.color,
      }),
    new ScatterplotLayer<MapFeature>({
      id: "points",
      data: points,
      pickable: true,
      stroked: true,
      radiusUnits: "pixels",
      lineWidthUnits: "pixels",
      getPosition: (d) => d.position,
      getRadius: (d) => d.radius,
      getFillColor: (d) => d.color,
      getLineColor: [255, 255, 255, 235],
      getLineWidth: 2,
    }),
    new ScatterplotLayer<MapFeature>({
      id: "focus",
      data: focused,
      filled: false,
      stroked: true,
      radiusUnits: "pixels",
      lineWidthUnits: "pixels",
      getPosition: (d) => d.position,
      getRadius: (d) => d.radius + (d.id === selectedId ? 5 : 3),
      getLineColor: (d) => (d.id === selectedId ? [15, 23, 42, 255] : [15, 23, 42, 110]),
      getLineWidth: 2,
      updateTriggers: { getRadius: selectedId, getLineColor: selectedId },
    }),
  ].filter(Boolean);
}

/**
 * MapLibre basemap + deck.gl analytical layers. Owns the imperative map
 * instance; everything it draws comes from `frame`, computed upstream.
 */
export function MapCanvas({
  frame,
  view,
  extent,
  toggles,
  selectedId,
  hoveredId,
  resetToken,
  basemap,
  onHover,
  onSelect,
  onStatus,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const hasTerrainRef = useRef(false);
  const cameraKeyRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onHover, onSelect, onStatus });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeBasemap, setActiveBasemap] = useState(basemap);

  useEffect(() => {
    callbacksRef.current = { onHover, onSelect, onStatus };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: MaplibreMap;
    try {
      map = new MaplibreMap({
        container,
        style: basemap.style,
        bounds: EXTENT_BOUNDS[extent],
        fitBoundsOptions: { padding: 36 },
        maxPitch: 70,
        attributionControl: { compact: true },
      });
    } catch {
      // Deferred so the failure is reported outside this effect's body.
      setTimeout(() => setFailed(true), 0);
      return;
    }
    mapRef.current = map;

    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric", maxWidth: 96 }), "bottom-right");

    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
      onHover: (info: PickingInfo<MapFeature>) => {
        map.getCanvas().style.cursor = info.object ? "pointer" : "";
        callbacksRef.current.onHover(
          info.object ? { id: info.object.id, x: info.x, y: info.y } : null,
        );
      },
      onClick: (info: PickingInfo<MapFeature>) => {
        callbacksRef.current.onSelect(info.object?.id ?? null);
      },
      onError: () => {
        callbacksRef.current.onStatus?.(basemap, "Analytical layers could not render.");
      },
    });
    map.addControl(overlay);
    overlayRef.current = overlay;

    let styleLoaded = false;
    let fellBack = false;
    let tileIssueReported = false;
    const activeBasemapRef = { current: basemap };
    map.on("error", (event: MaplibreErrorEvent) => {
      const status = (event.error as { status?: number } | undefined)?.status;
      if (!styleLoaded && !fellBack && status && status >= 400) {
        // Configured style rejected (bad key, quota, typo): use the key-less basemap.
        fellBack = true;
        map.setStyle(FALLBACK_BASEMAP.style);
        setActiveBasemap(FALLBACK_BASEMAP);
        callbacksRef.current.onStatus?.(
          FALLBACK_BASEMAP,
          `Configured basemap was rejected (HTTP ${status}); using fallback.`,
        );
        return;
      }
      if (styleLoaded && !tileIssueReported && "tile" in event) {
        tileIssueReported = true;
        callbacksRef.current.onStatus?.(
          activeBasemapRef.current,
          "Some basemap tiles failed to load; analytical layers are unaffected.",
        );
      }
    });

    map.on("style.load", () => {
      styleLoaded = true;
      activeBasemapRef.current = fellBack ? FALLBACK_BASEMAP : basemap;
      const terrainUrl = activeBasemapRef.current.terrainUrl;
      hasTerrainRef.current = Boolean(terrainUrl);
      if (terrainUrl && !map.getSource(TERRAIN_SOURCE)) {
        map.addSource(TERRAIN_SOURCE, { type: "raster-dem", url: terrainUrl, tileSize: 256 });
      }
      map.setSky({
        "sky-color": "#dbe4ea",
        "horizon-color": "#f3f1ec",
        "sky-horizon-blend": 0.6,
        "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
      });
      cameraKeyRef.current = null;
      setReady(false);
      setTimeout(() => setReady(true), 0);
    });

    return () => {
      overlayRef.current = null;
      mapRef.current = null;
      map.remove();
    };
    // The map is created once; view, extent and basemap changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Projection, terrain and camera. 2D↔3D keeps the user's framing and only
  // tilts; entering or leaving the globe, changing extent, or resetting
  // re-frames to the mode's default extent.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const previous = cameraKeyRef.current;
    const [prevView, prevExtent, prevReset] = previous?.split("|") ?? [];
    cameraKeyRef.current = `${view}|${extent}|${resetToken}`;

    applyProjection(map, view, hasTerrainRef.current);

    const onlyTilt =
      previous !== null &&
      prevExtent === extent &&
      prevReset === String(resetToken) &&
      prevView !== "globe" &&
      view !== "globe";

    if (onlyTilt) {
      map.easeTo({ ...VIEW_CAMERA[view], duration: CAMERA_DURATION });
    } else {
      const camera = cameraFor(map, extent, view);
      map.easeTo({ ...camera, duration: previous === null ? 0 : CAMERA_DURATION });
    }
  }, [view, extent, resetToken, ready]);

  useEffect(() => {
    overlayRef.current?.setProps({
      layers: buildLayers(frame, view, toggles, selectedId, hoveredId),
    });
  }, [frame, view, toggles, selectedId, hoveredId]);

  if (failed) {
    return (
      <div className="absolute inset-0">
        <MapFallback
          heightClassName="h-full"
          selectedId={selectedId}
          onSelect={(id) => onSelect(id)}
          markers={frame.features.map((f) => ({
            id: f.id,
            longitude: f.position[0],
            latitude: f.position[1],
            status: "normal",
            color: `rgb(${f.color[0]} ${f.color[1]} ${f.color[2]})`,
            label: f.name,
            sublabel: f.classLabel,
          }))}
        />
        <p className="absolute bottom-3 left-3 rounded bg-white/90 px-2 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
          WebGL unavailable — schematic view without basemap, 3D or globe.
        </p>
      </div>
    );
  }

  // MapLibre sets position: relative on its container, so positioning lives
  // on a wrapper and the container only fills it.
  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className={cn("sigma-map h-full w-full", activeBasemap.isRaster && "sigma-map--raster")}
      />
    </div>
  );
}
