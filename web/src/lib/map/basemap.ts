import type { StyleSpecification } from "maplibre-gl";

/**
 * Basemap resolution. Order of precedence:
 *   1. NEXT_PUBLIC_MAP_STYLE_URL — any MapLibre style URL (explicit override)
 *   2. NEXT_PUBLIC_MAPTILER_KEY  — MapTiler Cloud vector style + terrain DEM
 *   3. Key-less fallback         — standard OpenStreetMap raster tiles
 *
 * NEXT_PUBLIC_* values are inlined at build time, so they must be referenced
 * literally (not via process.env[name]). A MapTiler browser key is public by
 * design; restrict it to your deployment origins in the MapTiler dashboard.
 */

export type BasemapProvider = "maptiler" | "custom" | "osm-fallback";

export interface ResolvedBasemap {
  provider: BasemapProvider;
  style: string | StyleSpecification;
  /** Raster DEM TileJSON URL for 3D terrain; null when unavailable. */
  terrainUrl: string | null;
  /** Raster styles get a muting CSS filter so data layers stay dominant. */
  isRaster: boolean;
  label: string;
}

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim() ?? "";
const MAPTILER_STYLE = process.env.NEXT_PUBLIC_MAPTILER_STYLE?.trim() || "dataviz";
const CUSTOM_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() ?? "";

const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    basemap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#eef0ee" } },
    { id: "basemap", type: "raster", source: "basemap" },
  ],
};

/** Used when a configured style is rejected (e.g. an invalid MapTiler key). */
export const FALLBACK_BASEMAP: ResolvedBasemap = {
  provider: "osm-fallback",
  style: OSM_RASTER_STYLE,
  terrainUrl: null,
  isRaster: true,
  label: "OpenStreetMap (fallback)",
};

function maptilerTerrainUrl(): string | null {
  return MAPTILER_KEY
    ? `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${encodeURIComponent(MAPTILER_KEY)}`
    : null;
}

export function resolveBasemap(): ResolvedBasemap {
  if (CUSTOM_STYLE_URL) {
    return {
      provider: "custom",
      style: CUSTOM_STYLE_URL,
      terrainUrl: maptilerTerrainUrl(),
      isRaster: false,
      label: "Custom basemap",
    };
  }
  if (MAPTILER_KEY) {
    return {
      provider: "maptiler",
      style: `https://api.maptiler.com/maps/${encodeURIComponent(MAPTILER_STYLE)}/style.json?key=${encodeURIComponent(MAPTILER_KEY)}`,
      terrainUrl: maptilerTerrainUrl(),
      isRaster: false,
      label: "MapTiler",
    };
  }
  return FALLBACK_BASEMAP;
}
