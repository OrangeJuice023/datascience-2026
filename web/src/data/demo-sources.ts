import type { SourceCategory, SourceRecord } from "@/types";

/**
 * DEMO DATA — illustrative source metadata only. No real articles,
 * agencies, or reports are represented; extracted-event text is generic
 * by design.
 */
export const DEMO_SOURCES: SourceRecord[] = [
  { id: "src-01", category: "government", timestamp: "2026-09-19T08:00:00Z", extractedEvent: "Weekly indicator summary noted increase in reported cases", locationName: "Quezon City", confidence: "high" },
  { id: "src-02", category: "news", timestamp: "2026-09-18T14:30:00Z", extractedEvent: "Local news mention of rising fever-related consultations", locationName: "Quezon City", confidence: "medium" },
  { id: "src-03", category: "lgu", timestamp: "2026-09-18T09:15:00Z", extractedEvent: "Barangay health post activity update", locationName: "Quezon City", confidence: "medium" },
  { id: "src-04", category: "news", timestamp: "2026-09-17T11:00:00Z", extractedEvent: "Regional outlet coverage of clinic visit volume", locationName: "Quezon City", confidence: "low" },
  { id: "src-05", category: "other", timestamp: "2026-09-17T07:45:00Z", extractedEvent: "Community forum discussion flagged for review", locationName: "Quezon City", confidence: "low" },
  { id: "src-06", category: "government", timestamp: "2026-09-16T08:00:00Z", extractedEvent: "Facility-level reporting update", locationName: "Quezon City", confidence: "high" },
  { id: "src-07", category: "lgu", timestamp: "2026-09-15T10:20:00Z", extractedEvent: "LGU advisory referencing increased case counts", locationName: "Quezon City", confidence: "medium" },
  { id: "src-08", category: "news", timestamp: "2026-09-14T16:00:00Z", extractedEvent: "News aggregator item tagged to local health topic", locationName: "Quezon City", confidence: "low" },
];

export const SOURCE_CATEGORY_LABEL: Record<SourceCategory, string> = {
  government: "Government",
  news: "News",
  lgu: "LGU",
  other: "Other public source",
};

export function sourceBreakdown(sources: SourceRecord[]) {
  const counts: Record<SourceCategory, number> = {
    government: 0,
    news: 0,
    lgu: 0,
    other: 0,
  };
  for (const source of sources) counts[source.category] += 1;
  return counts;
}
