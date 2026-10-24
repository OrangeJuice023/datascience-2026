"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import { SIGMA_HEX } from "@/lib/map/palette";
import {
  coverageOf,
  dohReason,
  earsReason,
  hasData,
  isEarsAlarm,
  weekOf,
  type SigmaData,
} from "@/lib/sigma/data";

const UNIT_TYPE_LABEL: Record<string, string> = {
  province_full: "Province",
  province_remainder: "Province, excluding separately reported cities",
  city_huc: "Highly urbanized city",
  city_icc: "Independent component city",
  city_cc: "Component city (reported separately)",
  municipality: "Municipality",
};

/**
 * One reporting unit in the SIGMA mode: the selected week's result and why,
 * the whole weekly series with DOH thresholds and EARS alarms, coverage, and
 * the caveats that every reading of these results depends on.
 */
export function SigmaDetailPanel({
  data,
  unitId,
  week,
  onClose,
}: {
  data: SigmaData;
  unitId: string;
  /** ISO week (the timeline slice key). */
  week: string | undefined;
  onClose: () => void;
}) {
  const unit = data.units.find((u) => u.id === unitId);
  const weekIndex = week ? data.meta.weeks.indexOf(week) : -1;

  const series = useMemo(() => {
    if (!unit) return [];
    return data.meta.weeks.map((iso, i) => {
      const w = weekOf(data, unit, i);
      return {
        week: iso,
        cases: hasData(w) ? w.value : null,
        alert: w.alert,
        epidemic: w.epidemic,
        alarm: isEarsAlarm(w) ? w.value : null,
      };
    });
  }, [data, unit]);

  const yearTicks = useMemo(
    () => data.meta.weeks.filter((iso, i) => i === 0 || iso.slice(0, 4) !== data.meta.weeks[i - 1].slice(0, 4)),
    [data],
  );

  if (!unit) return null;
  // Scale to the reported cases; thresholds above that (e.g. 2020, with 2019 in the baseline) run off the top.
  const yMax = Math.max(10, ...series.map((d) => d.cases ?? 0)) * 1.15;
  const coverage = coverageOf(data, unit);
  const w = weekIndex >= 0 ? weekOf(data, unit, weekIndex) : null;
  const excludedNames = unit.excludes
    .map((id) => data.units.find((u) => u.id === id)?.name ?? id)
    .join(", ");

  return (
    <div>
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="text-xs font-medium text-slate-400">{unit.region}</p>
          <h3 className="text-base font-semibold text-ink">{unit.name}</h3>
          <p className="text-xs text-slate-500">
            {UNIT_TYPE_LABEL[unit.unitType] ?? unit.unitType}
            {excludedNames && ` (${excludedNames})`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-slate-500 hover:bg-slate-100 hover:text-ink sm:-mr-1 sm:-mt-1 sm:h-8 sm:w-8"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {w && (
        <div className="border-b border-border bg-raised px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-400">
              Week of {formatIsoDate(w.week)}
            </p>
            <EvidenceBadge kind="model" />
          </div>
          <dl className="mt-2 space-y-1.5 text-xs">
            <div>
              <dt className="text-slate-400">Reported cases</dt>
              <dd className="font-medium text-slate-700">
                {hasData(w) ? formatCount(w.value ?? 0) : w.quality === "suspect swap" ? "No data (suspect swap week)" : "No data (missing week)"}
                {w.flag && <span className="ml-1 font-normal text-amber-700">· {w.flag}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">EARS</dt>
              <dd className="font-medium text-slate-700">{earsReason(w, data)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">DOH threshold</dt>
              <dd className="font-medium text-slate-700">{dohReason(w)}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="border-b border-border px-2 pb-2 pt-3">
        <p className="px-2 text-xs font-medium text-slate-700">Weekly reported cases, 2016–2021</p>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#ebe8e1" vertical={false} />
            <XAxis
              dataKey="week"
              ticks={yearTicks}
              tickFormatter={(iso: string) => iso.slice(0, 4)}
              tick={{ fontSize: 12, fill: "#6f6d66" }}
              axisLine={{ stroke: "#ebe8e1" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, Math.ceil(yMax)]}
              allowDataOverflow
              tick={{ fontSize: 12, fill: "#6f6d66" }}
              axisLine={false}
              tickLine={false}
              width={36}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} />
            {w && <ReferenceLine x={w.week} stroke="#22231f" strokeDasharray="3 3" />}
            <Line dataKey="cases" name="Reported cases" stroke={SIGMA_HEX.cases} strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line dataKey="alert" name="DOH alert threshold" stroke={SIGMA_HEX.alert} strokeDasharray="4 3" strokeWidth={1} dot={false} isAnimationActive={false} />
            <Line dataKey="epidemic" name="DOH epidemic threshold" stroke={SIGMA_HEX.epidemic} strokeDasharray="4 3" strokeWidth={1} dot={false} isAnimationActive={false} />
            <Scatter dataKey="alarm" name="EARS alarm" fill={SIGMA_HEX.alarm} shape="circle" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="px-2 text-xs leading-snug text-slate-400">
          Breaks in the line are missing or suspect weeks (no data). Red dots: EARS alarm weeks. Dashed: DOH alert and
          epidemic thresholds (from 2019); the axis is scaled to reported cases, so higher thresholds run off the top.
        </p>
      </div>

      <dl className="space-y-1 border-b border-border px-4 py-3 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-400">Weeks with data</dt>
          <dd className="text-right text-slate-700">
            {coverage.ok} of {data.meta.weeks.length}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-400">Missing / suspect swap weeks</dt>
          <dd className="text-right text-slate-700">
            {coverage.missing} / {coverage.suspectSwap}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-400">Last available week</dt>
          <dd className="text-right text-slate-700">
            {coverage.lastWithData ? formatIsoDate(coverage.lastWithData) : "—"}
          </dd>
        </div>
      </dl>

      <div className="space-y-1.5 px-4 py-3 text-xs leading-snug text-slate-500">
        <p className="font-medium text-amber-800">
          Retrospective prototype. Signals show change relative to this unit&apos;s own history, not local risk or
          incidence, and are not a validated public-health claim.
        </p>
        <p>{data.meta.weekNote}</p>
        <ul className="list-disc space-y-0.5 pl-4">
          {data.meta.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="text-slate-400">
          Source: {data.meta.source}. Boundaries: geoBoundaries (CC BY 3.0 IGO), matched to OCHA COD-AB.
        </p>
      </div>
    </div>
  );
}
