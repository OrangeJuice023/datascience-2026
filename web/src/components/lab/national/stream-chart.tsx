"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import { AXIS_TICK, GRID, OBSERVED, compactCount } from "./weekly-history-chart";

export interface StreamBar {
  key: string;
  label: string;
  /** Null for a period with no record: an empty slot, never a zero. */
  value: number | null;
  /** False marks a partial sum (e.g. an epi year with missing weeks). */
  complete?: boolean;
  periodStart?: string;
  periodEnd?: string;
  sourceRecordId?: string | null;
}

function StreamTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: StreamBar }> }) {
  const bar = active ? payload?.[0]?.payload : undefined;
  if (!bar) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-slate-700">
        {bar.periodStart && bar.periodEnd
          ? `${formatIsoDate(bar.periodStart)} – ${formatIsoDate(bar.periodEnd)}`
          : bar.label}
      </p>
      {bar.value === null ? (
        <p className="mt-1 text-slate-500">No record</p>
      ) : (
        <p className="mt-1">
          <span className="text-slate-500">
            {bar.complete === false ? "Partial sum (not an annual total): " : "Reported cases: "}
          </span>
          <span className="font-semibold tabular-nums text-slate-900">{formatCount(bar.value)}</span>
        </p>
      )}
      {bar.sourceRecordId && <p className="mt-0.5 text-[10px] text-slate-400">Record {bar.sourceRecordId}</p>}
    </div>
  );
}

/** Bars for one aggregate series on its own axis; partial periods drawn pale. */
export function StreamChart({ bars, height = 220 }: { bars: StreamBar[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={16} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={compactCount} />
        <Tooltip content={<StreamTooltip />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" name="Reported cases" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {bars.map((bar) => (
            <Cell key={bar.key} fill={OBSERVED} fillOpacity={bar.complete === false ? 0.3 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
