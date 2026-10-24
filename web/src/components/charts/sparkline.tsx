"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { TrendPoint } from "@/types";

export function Sparkline({
  data,
  height = 48,
}: {
  data: TrendPoint[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          dataKey="observed"
          stroke="#2468c9"
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="expected"
          stroke="#c9c5bb"
          strokeWidth={1.25}
          strokeDasharray="3 2"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
