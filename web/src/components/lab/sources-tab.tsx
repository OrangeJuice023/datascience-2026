import { Card } from "@/components/ui/card";
import {
  DEMO_SOURCES,
  SOURCE_CATEGORY_LABEL,
  sourceBreakdown,
} from "@/data/demo-sources";
import { CONFIDENCE_LABEL } from "@/lib/status";
import { formatShortDate } from "@/lib/utils";
import type { SourceCategory } from "@/types";

export function SourcesTab() {
  const breakdown = sourceBreakdown(DEMO_SOURCES);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <p className="mb-3 text-xs font-semibold text-slate-600">
          Source breakdown
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(breakdown) as SourceCategory[]).map((category) => (
            <div
              key={category}
              className="rounded-md border border-slate-200 p-3"
            >
              <p className="text-[11px] font-medium text-slate-400">
                {SOURCE_CATEGORY_LABEL[category]}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                {breakdown[category]}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DEMO_SOURCES.map((source) => (
          <Card key={source.id} className="p-4">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {SOURCE_CATEGORY_LABEL[source.category]}
              </span>
              <span className="text-[11px] text-slate-400">
                {formatShortDate(source.timestamp)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{source.extractedEvent}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>{source.locationName}</span>
              <span>{CONFIDENCE_LABEL[source.confidence]}</span>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Source entries are illustrative examples and do not represent actual
        scraped articles or reports.
      </p>
    </div>
  );
}
