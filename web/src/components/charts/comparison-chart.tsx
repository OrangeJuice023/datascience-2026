"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/types";
import { formatShortDate } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

export function ComparisonChart({
  seriesA,
  seriesB,
  labelA,
  labelB,
  height = 260,
}: {
  seriesA: TrendPoint[];
  seriesB: TrendPoint[];
  labelA: string;
  labelB: string;
  height?: number;
}) {
  const merged = seriesA.map((point, i) => ({
    date: point.date,
    [labelA]: point.observed,
    [labelB]: seriesB[i]?.observed ?? null,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={merged} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
        <Line
          dataKey={labelA}
          stroke="#2468c9"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey={labelB}
          stroke="#9a978e"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
