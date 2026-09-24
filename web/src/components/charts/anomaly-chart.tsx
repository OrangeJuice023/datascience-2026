"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistogramBucket } from "@/lib/anomaly";
import { ChartTooltip } from "./chart-tooltip";

export function AnomalyChart({
  buckets,
  height = 220,
}: {
  buckets: HistogramBucket[];
  height?: number;
}) {
  const currentBucket = buckets.find((b) => b.isCurrent);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
        {currentBucket && (
          <ReferenceLine
            x={currentBucket.bucket}
            stroke="#e11d48"
            strokeDasharray="4 3"
            label={{
              value: "Current signal",
              position: "top",
              fill: "#e11d48",
              fontSize: 10,
            }}
          />
        )}
        <Bar
          dataKey="count"
          name="Historical periods"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        >
          {buckets.map((bucket) => (
            <Cell
              key={bucket.bucket}
              fill={bucket.isCurrent ? "#e11d48" : "#cbd5e1"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
