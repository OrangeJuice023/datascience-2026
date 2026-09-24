import type { ConfidenceLevel, SignalStatus } from "@/types";

interface StatusConfig {
  label: string;
  textClass: string;
  bgClass: string;
  ringClass: string;
  dotClass: string;
}

export const SIGNAL_STATUS_CONFIG: Record<SignalStatus, StatusConfig> = {
  normal: {
    label: "Normal",
    textClass: "text-slate-600",
    bgClass: "bg-slate-100",
    ringClass: "ring-slate-200",
    dotClass: "bg-slate-400",
  },
  watch: {
    label: "Watch",
    textClass: "text-amber-800",
    bgClass: "bg-amber-50",
    ringClass: "ring-amber-200",
    dotClass: "bg-amber-500",
  },
  elevated: {
    label: "Elevated",
    textClass: "text-rose-800",
    bgClass: "bg-rose-50",
    ringClass: "ring-rose-200",
    dotClass: "bg-rose-500",
  },
};

export const SEVERITY_ORDER: Record<SignalStatus, number> = {
  normal: 0,
  watch: 1,
  elevated: 2,
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export function confidenceFromSourceCount(count: number): ConfidenceLevel {
  if (count >= 6) return "high";
  if (count >= 3) return "medium";
  return "low";
}
