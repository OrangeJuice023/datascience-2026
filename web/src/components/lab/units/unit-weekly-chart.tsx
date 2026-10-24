"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TICK, GRID, compactCount } from "@/components/lab/national/weekly-history-chart";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import { SIGMA_HEX } from "@/lib/map/palette";
import { epiWeek } from "@/lib/national-observations";
import {
  dohClass,
  dohReason,
  earsReason,
  hasData,
  isEarsAlarm,
  weekOf,
  type SigmaData,
  type SigmaUnitSeries,
  type SigmaWeek,
} from "@/lib/sigma/data";

/** Column shading: weeks with no data, and weeks above a DOH threshold. */
export const BAND = {
  noData: { fill: "#cbd5e1", opacity: 0.5 },
  alert: { fill: SIGMA_HEX.alert, opacity: 0.2 },
  epidemic: { fill: SIGMA_HEX.epidemic, opacity: 0.16 },
} as const;

type BandKind = keyof typeof BAND;

interface ChartPoint {
  week: string;
  cases: number | null;
  /** A usable week with no usable neighbour, drawn as a dot because a line needs two points. */
  isolated: number | null;
  alarm: number | null;
  alert: number | null;
  epidemic: number | null;
}

function bandOf(w: SigmaWeek): BandKind | null {
  if (!hasData(w)) return "noData";
  const doh = dohClass(w);
  return doh === "epidemic" || doh === "alert" ? doh : null;
}

function UnitWeekTooltip({
  active,
  label,
  byWeek,
  data,
}: {
  active?: boolean;
  label?: string | number;
  byWeek: Map<string, SigmaWeek>;
  data: SigmaData;
}) {
  const w = active && typeof label === "string" ? byWeek.get(label) : undefined;
  if (!w) return null;
  const { year, week } = epiWeek(w.week);
  return (
    <div className="max-w-[17rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-slate-700">Week of {formatIsoDate(w.week)}</p>
      <p className="text-[11px] text-slate-400">
        MMWR {year}-W{String(week).padStart(2, "0")}
      </p>
      <p className="mt-1">
        <span className="text-slate-500">Reported cases: </span>
        {hasData(w) ? (
          <span className="font-semibold tabular-nums text-slate-900">{formatCount(w.value ?? 0)}</span>
        ) : (
          <span className="font-medium text-slate-500">
            No data ({w.quality === "suspect swap" ? "suspect swap week" : "missing week"})
          </span>
        )}
      </p>
      {w.flag && <p className="text-amber-700">Flagged: {w.flag} (value kept as published)</p>}
      <p className="mt-1 text-slate-600">
        <span className="text-slate-400">EARS: </span>
        {earsReason(w, data)}
      </p>
      <p className="text-slate-600">
        <span className="text-slate-400">DOH: </span>
        {dohReason(w)}
      </p>
    </div>
  );
}

/**
 * One reporting unit's weekly reported cases. Missing and suspect-swap weeks
 * are breaks in the line and grey columns, never zero. EARS alarm weeks are
 * dots on the line; weeks above the DOH alert or epidemic threshold are
 * shaded columns.
 */
export function UnitWeeklyChart({
  data,
  unit,
  year,
  showThresholds,
}: {
  data: SigmaData;
  unit: SigmaUnitSeries;
  /** An epi year, or null for the whole export. */
  year: number | null;
  showThresholds: boolean;
}) {
  const { points, byWeek, bands, ticks, yMax } = useMemo(() => {
    const all = data.meta.weeks.map((_, i) => weekOf(data, unit, i));
    const weeks = year === null ? all : all.filter((w) => epiWeek(w.week).year === year);
    const usable = weeks.map(hasData);

    const points: ChartPoint[] = weeks.map((w, k) => {
      const cases = usable[k] ? w.value : null;
      return {
        week: w.week,
        cases,
        isolated: cases !== null && !usable[k - 1] && !usable[k + 1] ? cases : null,
        alarm: isEarsAlarm(w) ? w.value : null,
        alert: w.alert,
        epidemic: w.epidemic,
      };
    });

    // Consecutive weeks of the same kind become one column.
    const bands: Array<{ kind: BandKind; from: string; to: string }> = [];
    let previous: BandKind | null = null;
    for (const w of weeks) {
      const kind = bandOf(w);
      if (kind && kind === previous) bands[bands.length - 1].to = w.week;
      else if (kind) bands.push({ kind, from: w.week, to: w.week });
      previous = kind;
    }

    const ticks =
      year === null
        ? weeks.filter((w, k) => k === 0 || epiWeek(w.week).year !== epiWeek(weeks[k - 1].week).year).map((w) => w.week)
        : weeks.filter((w) => epiWeek(w.week).week % 4 === 1).map((w) => w.week);

    const max = Math.max(0, ...points.map((p) => p.cases ?? 0));
    return {
      points,
      byWeek: new Map(weeks.map((w) => [w.week, w])),
      bands,
      ticks,
      yMax: Math.ceil(Math.max(5, max) * 1.1),
    };
  }, [data, unit, year]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        {bands.map((b) => (
          <ReferenceArea
            key={`${b.kind}-${b.from}`}
            x1={b.from}
            x2={b.to}
            fill={BAND[b.kind].fill}
            fillOpacity={BAND[b.kind].opacity}
            strokeOpacity={0}
          />
        ))}
        <XAxis
          dataKey="week"
          scale="band"
          ticks={ticks}
          tickFormatter={(iso: string) => (year === null ? String(epiWeek(iso).year) : `W${epiWeek(iso).week}`)}
          tick={AXIS_TICK}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis
          domain={[0, yMax]}
          allowDataOverflow
          allowDecimals={false}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={compactCount}
        />
        <Tooltip
          content={<UnitWeekTooltip byWeek={byWeek} data={data} />}
          cursor={{ stroke: "#94a3b8", strokeWidth: 1 }}
        />
        {showThresholds && (
          <Line
            dataKey="alert"
            name="DOH alert threshold"
            stroke={SIGMA_HEX.alert}
            strokeDasharray="4 3"
            strokeWidth={1.25}
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        )}
        {showThresholds && (
          <Line
            dataKey="epidemic"
            name="DOH epidemic threshold"
            stroke={SIGMA_HEX.epidemic}
            strokeDasharray="4 3"
            strokeWidth={1.25}
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        )}
        <Line
          dataKey="cases"
          name="Reported cases"
          stroke={SIGMA_HEX.cases}
          strokeWidth={1.75}
          dot={false}
          activeDot={{ r: 3 }}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Scatter dataKey="isolated" name="Reported cases" fill={SIGMA_HEX.cases} isAnimationActive={false} />
        <Scatter
          dataKey="alarm"
          name="EARS alarm"
          fill={SIGMA_HEX.alarm}
          stroke="#ffffff"
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
