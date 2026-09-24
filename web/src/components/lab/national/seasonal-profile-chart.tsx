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
import { formatCount } from "@/lib/map/format";
import type { SeasonalWeek } from "@/lib/national-observations";
import { AXIS_TICK, GRID, OBSERVED, compactCount } from "./weekly-history-chart";

function SeasonalTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SeasonalWeek }>;
}) {
  const week = active ? payload?.[0]?.payload : undefined;
  if (!week) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-slate-700">MMWR week {week.week}</p>
      {week.median === null ? (
        <p className="mt-1 text-slate-500">No recorded years</p>
      ) : (
        <dl className="mt-1 space-y-0.5">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Median</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{formatCount(week.median)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Range</dt>
            <dd className="tabular-nums text-slate-700">
              {formatCount(week.min!)}–{formatCount(week.max!)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Years with a record</dt>
            <dd className="tabular-nums text-slate-700">{week.years}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

/**
 * Descriptive seasonal profile: per-week median and min–max across epi
 * years that have a record. Not a baseline model and not an expected value.
 */
export function SeasonalProfileChart({ weeks }: { weeks: SeasonalWeek[] }) {
  const data = weeks.map((w) => ({
    ...w,
    bandBase: w.min,
    bandRange: w.min === null || w.max === null ? null : w.max - w.min,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="week" tick={AXIS_TICK} axisLine={{ stroke: GRID }} tickLine={false} interval={3} tickFormatter={(w: number) => `W${w}`} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={compactCount} />
        <Tooltip content={<SeasonalTooltip />} cursor={{ stroke: "#94a3b8", strokeWidth: 1 }} />
        <Area dataKey="bandBase" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} connectNulls={false} />
        <Area
          dataKey="bandRange"
          stackId="band"
          name="Min–max across years"
          stroke="none"
          fill={OBSERVED}
          fillOpacity={0.12}
          isAnimationActive={false}
          connectNulls={false}
        />
        <Line dataKey="median" name="Median" stroke={OBSERVED} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
