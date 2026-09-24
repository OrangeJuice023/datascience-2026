import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { consecutiveElevatedPeriods } from "@/lib/anomaly";
import { formatMultiplier, formatSignedPercent } from "@/lib/utils";
import type { Signal, TrendPoint } from "@/types";

export function TrendTab({ signal, trend }: { signal: Signal; trend: TrendPoint[] }) {
  const periods = consecutiveElevatedPeriods(trend);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-600">
          Observed vs. expected / historical baseline
        </p>
        <TrendChart data={trend} height={300} />
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Current signal"
          value={formatMultiplier(signal.signalLevel)}
          hint="Demo value"
        />
        <StatCard
          label="Rate of change"
          value={formatSignedPercent(signal.changePercent)}
          tone={signal.changePercent > 0 ? "elevated" : "default"}
          hint="Demo value"
        />
        <StatCard
          label="Consecutive elevated periods"
          value={String(periods)}
          hint="Weeks, demo value"
        />
        <StatCard
          label="Sources"
          value={String(signal.sourceCount)}
          hint="Demo value"
        />
      </div>
    </div>
  );
}
