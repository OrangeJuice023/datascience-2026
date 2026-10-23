/**
 * UI view models. Data-layer contracts live in ./data; the primitives the two
 * share are re-exported here so existing imports keep working.
 */
import type { ConfidenceLevel, SignalStatus } from "./data";

export type { ConfidenceLevel, SignalStatus, TrendPoint } from "./data";

export interface LGU {
  id: string;
  name: string;
  province: string;
  region: string;
  latitude: number;
  longitude: number;
}

export interface Signal {
  id: string;
  disease: string;
  locationId: string;
  locationName: string;
  date: string;
  /** Multiplier vs. historical baseline, e.g. 2.1 = 2.1x baseline. */
  signalLevel: number;
  sourceCount: number;
  confidence: ConfidenceLevel;
  changePercent: number;
  status: SignalStatus;
}

export type AssessmentStatus = "for-assessment" | "monitoring";

export interface PolicyInsight {
  category: string;
  title: string;
  rationale: string;
  evidenceType: string;
  assessmentStatus: AssessmentStatus;
}

export type SourceCategory = "government" | "news" | "lgu" | "other";

export interface SourceRecord {
  id: string;
  category: SourceCategory;
  timestamp: string;
  extractedEvent: string;
  locationName: string;
  confidence: ConfidenceLevel;
}

export interface NeighborSummary {
  locationId: string;
  locationName: string;
  /** The disease the summary describes; neighbours are never mixed across diseases. */
  disease: string;
  /** Null when the neighbour has no signal for this disease in the reporting window ("no data", not "normal"). */
  status: SignalStatus | null;
  changePercent: number | null;
  /** Date of the signal summarised, or null with no signal. */
  date: string | null;
}
