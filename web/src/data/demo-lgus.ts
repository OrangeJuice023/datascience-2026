import type { LGU } from "@/types";

/**
 * Local government unit reference data. Names, provinces, and coordinates
 * are real geography (public domain), used only as a spatial frame for
 * DEMO signal data — none of the health figures attached to these LGUs
 * elsewhere in the app are real.
 */
export const DEMO_LGUS: LGU[] = [
  { id: "quezon-city", name: "Quezon City", province: "Metro Manila", region: "NCR", latitude: 14.676, longitude: 121.0437 },
  { id: "manila", name: "Manila", province: "Metro Manila", region: "NCR", latitude: 14.5995, longitude: 120.9842 },
  { id: "makati", name: "Makati", province: "Metro Manila", region: "NCR", latitude: 14.5547, longitude: 121.0244 },
  { id: "pasig", name: "Pasig", province: "Metro Manila", region: "NCR", latitude: 14.5764, longitude: 121.0851 },
  { id: "taguig", name: "Taguig", province: "Metro Manila", region: "NCR", latitude: 14.5176, longitude: 121.0509 },
  { id: "mandaluyong", name: "Mandaluyong", province: "Metro Manila", region: "NCR", latitude: 14.5794, longitude: 121.0359 },
  { id: "marikina", name: "Marikina", province: "Metro Manila", region: "NCR", latitude: 14.6507, longitude: 121.1029 },
  { id: "pasay", name: "Pasay", province: "Metro Manila", region: "NCR", latitude: 14.5378, longitude: 121.0014 },
  { id: "paranaque", name: "Parañaque", province: "Metro Manila", region: "NCR", latitude: 14.4793, longitude: 121.0198 },
  { id: "caloocan", name: "Caloocan", province: "Metro Manila", region: "NCR", latitude: 14.6488, longitude: 120.9673 },
  { id: "san-juan", name: "San Juan", province: "Metro Manila", region: "NCR", latitude: 14.6019, longitude: 121.0355 },
  { id: "antipolo", name: "Antipolo", province: "Rizal", region: "Region IV-A (CALABARZON)", latitude: 14.5878, longitude: 121.176 },
];

export function getLguById(id: string): LGU | undefined {
  return DEMO_LGUS.find((lgu) => lgu.id === id);
}

export function getNeighborLgus(id: string, count = 3): LGU[] {
  const origin = getLguById(id);
  if (!origin) return [];
  return DEMO_LGUS.filter((lgu) => lgu.id !== id)
    .map((lgu) => ({
      lgu,
      distance: Math.hypot(
        lgu.latitude - origin.latitude,
        lgu.longitude - origin.longitude,
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map((entry) => entry.lgu);
}
