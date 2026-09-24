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

/** Planned progression; nothing past level 0 (observed data) exists yet. */
const ROADMAP = [
  { level: 1, name: "Seasonal / historical baseline", detail: "Expected weekly activity from prior years at the same point in the season." },
  { level: 2, name: "Farrington / EARS-style anomaly detection", detail: "Excess over the baseline with an explicit alert threshold." },
  { level: 3, name: "Forecasting baseline", detail: "SARIMA or Holt-Winters, backtested with rolling origins." },
  { level: 4, name: "ML benchmark", detail: "XGBoost or comparable, compared against levels 1–3." },
  { level: 5, name: "Spatiotemporal model", detail: "Requires reconciled sub-national formal data." },
  { level: 6, name: "Scenario simulation", detail: "Assumption-driven what-ifs; never presented as forecasts." },
];

/**
 * Observed vs expected vs alert threshold. Renders a chart only from real
 * AnomalyResult records; with none, it says so instead of inventing a score.
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
          <p className="text-sm font-semibold text-slate-900">Historical baseline</p>
          <EvidenceBadge kind="model" />
        </div>
        <p className="text-xs text-slate-500">
          Baseline:{" "}
          <span className="font-medium text-slate-700">
            {fitted && model ? `${model.name} v${model.version}` : "Not yet fitted"}
          </span>
        </p>
      </div>
      <p className="mt-1 max-w-3xl text-xs text-slate-500">
        SIGMA will compare current observations against historical expected activity before
        producing anomaly indicators.
      </p>

      {fitted ? (
        <ResponsiveContainer width="100%" height={260} className="mt-3">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tick={AXIS_TICK} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={32} tickFormatter={(d: string) => formatIsoDate(d, { month: "short", year: "numeric" })} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={compactCount} />
            <Tooltip content={<ChartTooltip />} />
            <Area dataKey="bandBase" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
            <Area dataKey="bandRange" stackId="band" name="Expected range" stroke="none" fill="#7c3aed" fillOpacity={0.1} isAnimationActive={false} />
            <Line dataKey="expected" name="Expected" stroke="#7c3aed" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line dataKey="threshold" name="Alert threshold" stroke="#b91c1c" strokeWidth={1} dot={false} isAnimationActive={false} />
            <Line dataKey="observed" name="Observed" stroke={OBSERVED} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <DataStateNotice state="model-not-fitted" className="mt-3">
          No baseline has been fitted to the formal series, so no expected range, alert threshold
          or anomaly score is shown. When a model runs, its outputs arrive as typed
          <code className="mx-1 rounded bg-white/70 px-1">AnomalyResult</code>
          records (observed, expected, range, score, classification, model and version) and this
          panel draws observed vs expected vs alert threshold.
        </DataStateNotice>
      )}

      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ROADMAP.map((step) => (
          <li key={step.level} className="rounded-md border border-slate-200 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Level {step.level} · Not started
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-800">{step.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">{step.detail}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
