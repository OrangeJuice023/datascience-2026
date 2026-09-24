import type { Signal } from "@/types";
import type { MapMarkerData } from "@/components/maps/types";
import { getLguById } from "@/data/demo-lgus";
import { SEVERITY_ORDER, SIGNAL_STATUS_CONFIG } from "@/lib/status";

export function signalsToMapMarkers(signals: Signal[]): MapMarkerData[] {
  const byLocation = new Map<string, Signal>();
  for (const signal of signals) {
    const existing = byLocation.get(signal.locationId);
    if (!existing || SEVERITY_ORDER[signal.status] > SEVERITY_ORDER[existing.status]) {
      byLocation.set(signal.locationId, signal);
    }
  }

  const markers: MapMarkerData[] = [];
  byLocation.forEach((signal, locationId) => {
    const lgu = getLguById(locationId);
    if (!lgu) return;
    markers.push({
      id: locationId,
      longitude: lgu.longitude,
      latitude: lgu.latitude,
      status: signal.status,
      label: lgu.name,
      sublabel: `${signal.disease} · ${SIGNAL_STATUS_CONFIG[signal.status].label}`,
    });
  });
  return markers;
}
