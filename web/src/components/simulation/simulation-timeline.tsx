"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SimulationResultPoint } from "@/types";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

export function SimulationTimeline({
  data,
  interventionDay,
  height = 240,
}: {
  data: SimulationResultPoint[];
  interventionDay: number;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(d) => `Day ${d}`}
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          content={<ChartTooltip />}
          labelFormatter={(d) => `Day ${d}`}
        />
        <ReferenceLine
          x={interventionDay}
          stroke="#d97706"
          strokeDasharray="4 3"
          label={{
            value: "Intervention",
            position: "insideTopRight",
            fill: "#d97706",
            fontSize: 10,
          }}
        />
        <Line
          dataKey="intensity"
          name="Modeled intensity"
          stroke="#0d9488"
          strokeWidth={2}
          dot={{ r: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
