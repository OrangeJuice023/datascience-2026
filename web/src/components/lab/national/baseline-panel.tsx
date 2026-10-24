"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { DataStateNotice } from "@/components/ui/data-state-notice";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { formatIsoDate } from "@/lib/map/format";
import type { AnomalyResult } from "@/types/data";
import { AXIS_TICK, GRID, OBSERVED, compactCount } from "./weekly-history-chart";

/**
 * Observed vs expected vs alert threshold. Renders a chart only from real
 * AnomalyResult records; with none, it says where SIGMA's anomaly detection
 * does run (per reporting unit) instead of inventing a score.
 */
export function BaselinePanel({ results }: { results: AnomalyResult[] }) {
  const fitted = results.length > 0;
  const model = results[0]?.model;
  const data = [...results]
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .map((r) => ({
      date: r.periodStart,
      observed: r.observed,
      expected: r.expected,
      bandBase: r.lowerBound,
      bandRange: r.upperBound - r.lowerBound,
      threshold: r.upperBound,
    }));

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">Historical baseline</p>
          <EvidenceBadge kind="model" />
        </div>
        {fitted && model ? (
          <p className="text-xs text-slate-500">
            Baseline: <span className="font-medium text-slate-700">{`${model.name} v${model.version}`}</span>
          </p>
        ) : null}
      </div>
      <p className="mt-1 max-w-3xl text-xs text-slate-500">
        SIGMA runs its anomaly detection, EARS C1–C3 and the DOH alert and epidemic thresholds, on each of the 126
        reporting units: see the Reporting units tab, Explore, and{" "}
        <code className="rounded bg-raised px-1">/api/v1/dengue/signals</code>. This national series is shown as
        observed counts only.
      </p>

      {fitted ? (
        <ResponsiveContainer width="100%" height={260} className="mt-3">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tick={AXIS_TICK} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={32} tickFormatter={(d: string) => formatIsoDate(d, { month: "short", year: "numeric" })} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={compactCount} />
            <Tooltip content={<ChartTooltip />} />
            <Area dataKey="bandBase" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
            <Area dataKey="bandRange" stackId="band" name="Expected range" stroke="none" fill="#747d59" fillOpacity={0.1} isAnimationActive={false} />
            <Line dataKey="expected" name="Expected" stroke="#747d59" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line dataKey="threshold" name="Alert threshold" stroke="#c4242a" strokeWidth={1} dot={false} isAnimationActive={false} />
            <Line dataKey="observed" name="Observed" stroke={OBSERVED} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <DataStateNotice state="no-data" title="No baseline on the national series" className="mt-3">
          No expected range, alert threshold or anomaly score is drawn here, because none is computed for the
          national series. Forecasting is out of scope for this prototype: SIGMA has no validated forecast model.
        </DataStateNotice>
      )}
    </Card>
  );
}
