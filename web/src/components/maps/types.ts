import type { SignalStatus } from "@/types";

export interface MapMarkerData {
  id: string;
  longitude: number;
  latitude: number;
  status: SignalStatus;
  /** Overrides the status color, e.g. for analytical modes without a status. */
  color?: string;
  label: string;
  sublabel?: string;
}

export interface MapPanelProps {
  markers: MapMarkerData[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
  heightClassName?: string;
}
