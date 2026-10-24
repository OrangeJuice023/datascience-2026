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
import type { TrendPoint } from "@/types";
import { formatShortDate } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

export function TrendChart({
  data,
  height = 280,
}: {
  data: TrendPoint[];
  height?: number;
}) {
  const chartData = data.map((point) => ({
    ...point,
    bandBase: point.lowerBound,
    bandRange: point.upperBound - point.lowerBound,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={chartData}
        margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
      >
        <CartesianGrid stroke="#ebe8e1" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: 11, fill: "#6f6d66" }}
          axisLine={{ stroke: "#ebe8e1" }}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6f6d66" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          content={<ChartTooltip />}
          labelFormatter={(label) => formatShortDate(label as string)}
        />
        <Area
          dataKey="bandBase"
          stackId="band"
          stroke="none"
          fill="transparent"
          isAnimationActive={false}
        />
        <Area
          dataKey="bandRange"
          stackId="band"
          name="Historical range"
          stroke="none"
          fill="#2468c9"
          fillOpacity={0.1}
          isAnimationActive={false}
        />
        <Line
          dataKey="expected"
          name="Expected baseline"
          stroke="#9a978e"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="observed"
          name="Observed"
          stroke="#2468c9"
          strokeWidth={2}
          dot={{ r: 2, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
