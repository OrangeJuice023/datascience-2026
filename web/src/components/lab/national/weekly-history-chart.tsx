"use client";

import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import { epiWeek, type WeeklyPoint } from "@/lib/national-observations";

export const OBSERVED = "#0d9488";
export const AXIS_TICK = { fontSize: 11, fill: "#64748b" };
export const GRID = "#e2e8f0";

export function compactCount(value: number) {
  return value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value);
}

export function WeeklyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: WeeklyPoint }>;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-slate-700">Week of {formatIsoDate(point.periodStart)}</p>
      <p className="text-[11px] text-slate-400">
        MMWR {point.epiYear}-W{String(point.epiWeek).padStart(2, "0")}
      </p>
      {point.value === null ? (
        <p className="mt-1 font-medium text-slate-500">No weekly record in source</p>
      ) : (
        <>
          <p className="mt-1">
            <span className="text-slate-500">Reported cases: </span>
            <span className="font-semibold tabular-nums text-slate-900">{formatCount(point.value)}</span>
          </p>
          {point.sourceRecordId && (
            <p className="mt-0.5 text-[10px] text-slate-400">Record {point.sourceRecordId}</p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Full weekly record. Missing weeks are null, so the line breaks there
 * instead of dropping to zero or bridging the gap.
 */
export function WeeklyHistoryChart({ series }: { series: WeeklyPoint[] }) {
  const yearTicks = series.filter((p) => p.epiWeek === 1).map((p) => p.periodStart);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="periodStart"
          ticks={yearTicks}
          tickFormatter={(d: string) => String(epiWeek(d).year)}
          tick={AXIS_TICK}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={compactCount} />
        <Tooltip content={<WeeklyTooltip />} cursor={{ stroke: "#94a3b8", strokeWidth: 1 }} />
        <Line
          dataKey="value"
          name="Reported cases"
          stroke={OBSERVED}
          strokeWidth={1.75}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Brush
          dataKey="periodStart"
          height={26}
          stroke="#94a3b8"
          travellerWidth={8}
          tickFormatter={(d: string) => d.slice(0, 7)}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
