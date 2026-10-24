/**
 * Reporting-unit polygons for the maps, from the web app's committed
 * GeoJSON (web/public/geo/hdx-reporting-units.geojson, built by
 * scripts/geo/build-boundaries.mjs from geoBoundaries, CC BY 3.0 IGO). It is
 * a static file next to the API, so it is fetched from the API's origin.
 *
 * Geometry is for display only: it carries no case values.
 */

export const BOUNDARIES_PATH = '/geo/hdx-reporting-units.geojson';
export const BOUNDARIES_ATTRIBUTION = 'Boundaries: geoBoundaries (Runfola et al. 2020), CC BY 3.0 IGO';

type Ring = [number, number][];
interface Feature {
  properties: { id: string; name: string };
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
}
export interface Boundaries {
  features: Feature[];
}

export interface ProjectedUnit {
  id: string;
  name: string;
  /** SVG path in the projected frame. */
  d: string;
  /** Area-weighted centre of the largest polygon, in the projected frame (a label point, not where cases are). */
  center: [number, number];
}

export interface ProjectedMap {
  width: number;
  height: number;
  units: ProjectedUnit[];
  /** Projected units per kilometre, for a scale bar. */
  unitsPerKm: number;
}

/** `https://host/api/v1` -> `https://host/geo/hdx-reporting-units.geojson`. */
export function boundariesUrl(baseUrl: string): string {
  return baseUrl.replace(/\/api\/v\d+\/?$/, '') + BOUNDARIES_PATH;
}

const KM_PER_DEGREE = 111.32;

/**
 * Equirectangular projection scaled by cos(latitude) at the map's middle,
 * fitted to `width`. At the Philippines' latitudes (5-21 N) the shape error
 * is small and distances read well enough for a scale bar.
 */
export function projectBoundaries(geo: Boundaries, width: number): ProjectedMap {
  const polys = geo.features.map((f) => ({
    f,
    polys: f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates,
  }));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const { polys: ps } of polys) for (const p of ps) for (const [x, y] of p[0]) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const scale = width / ((maxX - minX) * k);
  const height = (maxY - minY) * scale;
  const px = (lon: number) => (lon - minX) * k * scale;
  const py = (lat: number) => (maxY - lat) * scale;

  const units = polys.map(({ f, polys: ps }) => {
    let d = '';
    let best = { area: -1, cx: 0, cy: 0 };
    for (const poly of ps) {
      for (const ring of poly) {
        d += ring.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join('') + 'Z';
      }
      // Shoelace centroid of the outer ring.
      let a = 0, cx = 0, cy = 0;
      const outer = poly[0];
      for (let i = 0; i < outer.length - 1; i++) {
        const [x0, y0] = [px(outer[i][0]), py(outer[i][1])];
        const [x1, y1] = [px(outer[i + 1][0]), py(outer[i + 1][1])];
        const c = x0 * y1 - x1 * y0;
        a += c;
        cx += (x0 + x1) * c;
        cy += (y0 + y1) * c;
      }
      if (Math.abs(a) > best.area) best = { area: Math.abs(a), cx: cx / (3 * a), cy: cy / (3 * a) };
    }
    return { id: f.properties.id, name: f.properties.name, d, center: [best.cx, best.cy] as [number, number] };
  });
  return { width, height, units, unitsPerKm: scale / KM_PER_DEGREE };
}

let cache: { url: string; promise: Promise<Boundaries> } | null = null;

/** Fetches (once per address) the reporting-unit polygons. */
export function fetchBoundaries(baseUrl: string): Promise<Boundaries> {
  const url = boundariesUrl(baseUrl);
  if (cache?.url !== url) {
    const promise = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`Map boundaries could not be loaded (HTTP ${res.status}).`);
      return (await res.json()) as Boundaries;
    });
    promise.catch(() => {
      if (cache?.url === url) cache = null; // retry next time
    });
    cache = { url, promise };
  }
  return cache.promise;
}
