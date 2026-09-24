import { Card } from "@/components/ui/card";
import { AnomalyChart } from "@/components/charts/anomaly-chart";
import { anomalyLabel, buildRatioHistogram } from "@/lib/anomaly";
import type { Signal, TrendPoint } from "@/types";

const WHY_FLAGGED = [
  "Recent activity exceeds historical range",
  "Increase sustained across multiple periods",
  "Multiple independent sources observed",
  "Neighboring areas show related activity",
];

export function AnomalyTab({ signal, trend }: { signal: Signal; trend: TrendPoint[] }) {
  const { buckets, currentRatio } = buildRatioHistogram(trend);
  const label = anomalyLabel(currentRatio);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Anomaly score
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
          {currentRatio.toFixed(2)}
        </p>
        <p className="mt-1 text-sm font-medium text-rose-700">{label}</p>
      </Card>

      {signal.status !== "normal" && (
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-600">Why flagged?</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            {WHY_FLAGGED.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {reason}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-600">
          Historical distribution vs. current signal
        </p>
        <AnomalyChart buckets={buckets} />
      </Card>

      <p className="text-xs text-slate-500">
        Anomaly scores are analytical indicators. They are not diagnoses or
        outbreak declarations.
      </p>
    </div>
  );
}
