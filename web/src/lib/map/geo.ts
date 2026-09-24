import type { MapExtent, MapViewMode } from "./types";

export type LngLat = [longitude: number, latitude: number];
export type Bounds = [southWest: LngLat, northEast: LngLat];

/** Demo LGU frame (Metro Manila + Antipolo) and the national extent. */
export const EXTENT_BOUNDS: Record<MapExtent, Bounds> = {
  metro: [
    [120.94, 14.45],
    [121.2, 14.71],
  ],
  national: [
    [116.9, 4.6],
    [126.6, 21.1],
  ],
};

export const PHILIPPINES_CENTER: LngLat = [121.8, 12.4];

export interface ViewCamera {
  pitch: number;
  bearing: number;
}

export const VIEW_CAMERA: Record<MapViewMode, ViewCamera> = {
  "2d": { pitch: 0, bearing: 0 },
  "3d": { pitch: 55, bearing: -18 },
  globe: { pitch: 0, bearing: 0 },
};

/**
 * Globe opens on regional context, zoomed out far enough that the curvature
 * reads as a globe; zooming in is up to the user.
 */
export const GLOBE_CAMERA = { center: PHILIPPINES_CENTER, zoom: 2.4 };

/** Great-circle distance in km. */
export function haversineKm(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** k nearest items by centroid distance, excluding the origin itself. */
export function nearestByDistance<T extends { id: string; longitude: number; latitude: number }>(
  items: T[],
  originId: string,
  count: number,
): Array<{ item: T; distanceKm: number }> {
  const origin = items.find((item) => item.id === originId);
  if (!origin) return [];
  return items
    .filter((item) => item.id !== originId)
    .map((item) => ({
      item,
      distanceKm: haversineKm(
        [origin.longitude, origin.latitude],
        [item.longitude, item.latitude],
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, count);
}
