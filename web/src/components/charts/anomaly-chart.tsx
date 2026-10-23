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
        <CartesianGrid stroke="#ebe8e1" vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 11, fill: "#6f6d66" }}
          axisLine={{ stroke: "#ebe8e1" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6f6d66" }}
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f2f1ed" }} />
        {currentBucket && (
          <ReferenceLine
            x={currentBucket.bucket}
            stroke="#e11d48"
            strokeDasharray="4 3"
            label={{
              value: "Current signal",
              position: "top",
              fill: "#e11d48",
              fontSize: 11,
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
              fill={bucket.isCurrent ? "#e11d48" : "#c9c5bb"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
