import type { Signal } from "@/types";
import { confidenceFromSourceCount } from "@/lib/status";

/**
 * DEMO DATA — illustrative public-health signals only.
 * None of these figures represent verified, real-world public-health
 * statistics. They exist to demonstrate the SIGMA interface.
 */
const RAW_SIGNALS: Array<Omit<Signal, "confidence">> = [
  { id: "sig-01", disease: "Dengue", locationId: "quezon-city", locationName: "Quezon City", date: "2026-09-18", signalLevel: 2.1, sourceCount: 8, changePercent: 46, status: "elevated" },
  { id: "sig-02", disease: "Leptospirosis", locationId: "quezon-city", locationName: "Quezon City", date: "2026-09-15", signalLevel: 1.4, sourceCount: 4, changePercent: 18, status: "watch" },
  { id: "sig-03", disease: "Dengue", locationId: "manila", locationName: "Manila", date: "2026-09-19", signalLevel: 1.9, sourceCount: 6, changePercent: 32, status: "elevated" },
  { id: "sig-04", disease: "Measles", locationId: "manila", locationName: "Manila", date: "2026-09-10", signalLevel: 1.3, sourceCount: 3, changePercent: 12, status: "watch" },
  { id: "sig-05", disease: "Dengue", locationId: "pasig", locationName: "Pasig", date: "2026-09-17", signalLevel: 2.3, sourceCount: 7, changePercent: 58, status: "elevated" },
  { id: "sig-06", disease: "Influenza-like illness", locationId: "pasig", locationName: "Pasig", date: "2026-09-14", signalLevel: 1.0, sourceCount: 2, changePercent: 2, status: "normal" },
  { id: "sig-07", disease: "Dengue", locationId: "caloocan", locationName: "Caloocan", date: "2026-09-16", signalLevel: 1.8, sourceCount: 5, changePercent: 29, status: "elevated" },
  { id: "sig-08", disease: "Diarrheal disease", locationId: "caloocan", locationName: "Caloocan", date: "2026-09-12", signalLevel: 1.5, sourceCount: 4, changePercent: 21, status: "watch" },
  { id: "sig-09", disease: "Dengue", locationId: "taguig", locationName: "Taguig", date: "2026-09-18", signalLevel: 2.0, sourceCount: 6, changePercent: 40, status: "elevated" },
  { id: "sig-10", disease: "Leptospirosis", locationId: "taguig", locationName: "Taguig", date: "2026-09-11", signalLevel: 1.1, sourceCount: 2, changePercent: 5, status: "normal" },
  { id: "sig-11", disease: "Dengue", locationId: "antipolo", locationName: "Antipolo", date: "2026-09-19", signalLevel: 2.5, sourceCount: 9, changePercent: 63, status: "elevated" },
  { id: "sig-12", disease: "Influenza-like illness", locationId: "antipolo", locationName: "Antipolo", date: "2026-09-13", signalLevel: 1.7, sourceCount: 4, changePercent: 25, status: "elevated" },
  { id: "sig-13", disease: "Dengue", locationId: "makati", locationName: "Makati", date: "2026-09-09", signalLevel: 1.0, sourceCount: 3, changePercent: 3, status: "normal" },
  { id: "sig-14", disease: "Influenza-like illness", locationId: "mandaluyong", locationName: "Mandaluyong", date: "2026-09-08", signalLevel: 0.9, sourceCount: 2, changePercent: -4, status: "normal" },
  { id: "sig-15", disease: "Leptospirosis", locationId: "marikina", locationName: "Marikina", date: "2026-09-14", signalLevel: 1.0, sourceCount: 2, changePercent: 6, status: "normal" },
  { id: "sig-16", disease: "Dengue", locationId: "pasay", locationName: "Pasay", date: "2026-09-07", signalLevel: 0.95, sourceCount: 2, changePercent: -2, status: "normal" },
  { id: "sig-17", disease: "Measles", locationId: "paranaque", locationName: "Parañaque", date: "2026-09-06", signalLevel: 1.0, sourceCount: 1, changePercent: 0, status: "normal" },
  { id: "sig-18", disease: "Diarrheal disease", locationId: "san-juan", locationName: "San Juan", date: "2026-09-05", signalLevel: 1.05, sourceCount: 2, changePercent: 4, status: "normal" },
];

export const DEMO_SIGNALS: Signal[] = RAW_SIGNALS.map((signal) => ({
  ...signal,
  confidence: confidenceFromSourceCount(signal.sourceCount),
}));

export const DEMO_DISEASES = Array.from(
  new Set(DEMO_SIGNALS.map((signal) => signal.disease)),
).sort();

export function getSignalsForLocation(locationId: string): Signal[] {
  return DEMO_SIGNALS.filter((signal) => signal.locationId === locationId);
}

export function getSignal(disease: string, locationId: string): Signal | undefined {
  return DEMO_SIGNALS.find(
    (signal) => signal.disease === disease && signal.locationId === locationId,
  );
}

export function getLocationIdsForDisease(disease: string): string[] {
  return Array.from(
    new Set(
      DEMO_SIGNALS.filter((signal) => signal.disease === disease).map(
        (signal) => signal.locationId,
      ),
    ),
  );
}

export const OVERVIEW_SUMMARY = {
  activeSignals: DEMO_SIGNALS.length,
  areasToReview: new Set(
    DEMO_SIGNALS.filter((s) => s.status !== "normal").map((s) => s.locationId),
  ).size,
  elevatedSignals: DEMO_SIGNALS.filter((s) => s.status === "elevated").length,
};
