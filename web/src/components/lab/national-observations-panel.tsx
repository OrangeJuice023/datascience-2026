"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import type { NationalSummary } from "@/lib/national-observations";
import { cn } from "@/lib/utils";

const OBSERVED = "#0d9488";
const AXIS_TICK = { fontSize: 11, fill: "#64748b" };

function compact(value: number) {
  return value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);
}

/**
 * Formal national observations. No baseline model has been run on this
 * series yet, so the panel shows reported counts only — no expected band,
 * no anomaly score.
 */
export function NationalObservationsPanel({ national }: { national: NationalSummary }) {
  const years = national.weeklyByYear.map((y) => y.year);
  const [year, setYear] = useState(years[years.length - 1]);
  const weeks = national.weeklyByYear.find((y) => y.year === year)?.weeks ?? [];
  const weeklyData = weeks.map((w) => ({
    date: w.periodStart,
    label: formatIsoDate(w.periodStart, { month: "short", day: "numeric" }),
    cases: w.value,
  }));
  const peak = weeks.reduce((max, w) => (w.value > max.value ? w : max), weeks[0]);
  const annualFirst = national.annual[0]?.year;
  const annualLast = national.annual[national.annual.length - 1]?.year;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-2 p-4 text-xs text-slate-600">
        <StatusBadge label="Observed data" tone="info" />
        <span>
          {national.source.name} v{national.source.version} · {national.source.license} · national
          resolution only
        </span>
        <span className="text-slate-400">
          Reported counts, not model output. Sub-national formal data is not available.
        </span>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Weekly coverage" value={years.join(", ")} hint="Years with weekly records" />
        <StatCard
          label="Annual coverage"
          value={`${annualFirst}–${annualLast}`}
          hint={`${national.missingAnnualYears.length} years without an annual record`}
        />
        <StatCard
          label={`Peak week, ${year}`}
          value={peak ? formatCount(peak.value) : "—"}
          hint={peak ? `Week of ${formatIsoDate(peak.periodStart)}` : undefined}
        />
        <StatCard
          label={`Weeks on record, ${year}`}
          value={String(weeks.length)}
          hint={weeks.length < 52 ? "Incomplete year in source" : "Full year"}
        />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-600">Reported dengue cases per week</p>
            <p className="text-[11px] text-slate-400">Philippines, national · case definition: total</p>
          </div>
          <div role="radiogroup" aria-label="Year" className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                role="radio"
                aria-checked={y === year}
                onClick={() => setYear(y)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium tabular-nums",
                  y === year ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800",
                )}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} minTickGap={24} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} tickFormatter={compact} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="cases" name="Reported cases" fill={OBSERVED} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-600">Reported dengue cases per year</p>
        <p className="mb-3 text-[11px] text-slate-400">
          Annual totals from mixed upstream sources. Missing years are left blank
          {national.missingAnnualYears.length > 0 && ` (${national.missingAnnualYears.join(", ")})`}.
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={national.annual} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={1}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} minTickGap={28} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} tickFormatter={compact} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="value" name="Reported cases" fill={OBSERVED} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <p className="text-xs text-slate-500">
        No baseline or anomaly model has been run on the national series yet, so no expected
        range or anomaly score is shown. Weekly, monthly and annual records are separate
        reporting streams and are not combined.
      </p>
    </div>
  );
}
