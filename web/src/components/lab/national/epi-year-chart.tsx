"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyPoint } from "@/lib/national-observations";
import { AXIS_TICK, GRID, OBSERVED, WeeklyTooltip, compactCount } from "./weekly-history-chart";

/** One MMWR year of weekly observations; missing weeks are shaded, not zeroed. */
export function EpiYearChart({ weeks }: { weeks: WeeklyPoint[] }) {
  const missing = weeks.filter((w) => w.value === null);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="epiWeek"
          tick={AXIS_TICK}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          interval={3}
          tickFormatter={(w: number) => `W${w}`}
        />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={compactCount} />
        {missing.map((w) => (
          <ReferenceArea
            key={w.periodStart}
            x1={w.epiWeek}
            x2={w.epiWeek}
            fill="#cbd5e1"
            fillOpacity={0.45}
            ifOverflow="extendDomain"
          />
        ))}
        <Tooltip content={<WeeklyTooltip />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" name="Reported cases" fill={OBSERVED} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
