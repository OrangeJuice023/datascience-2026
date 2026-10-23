"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import {
  COMPARABILITY_LABEL,
  QC_FLAG_LABEL,
  RELATION_LABEL,
  WEATHER_SOURCE_LABEL,
  WEATHER_VARIABLE_META,
  addDays,
  findSeries,
  qcFlagsAt,
  weekIndex,
  type EnvironmentBundle,
} from "@/lib/environment/bundle";
import { formatIsoDate } from "@/lib/map/format";
import { ENVIRONMENT_NOTE } from "@/lib/map/modes/environment";
import { WEATHER_SOURCE_HEX } from "@/lib/map/palette";
import type { WeatherSourceId, WeatherVariable } from "@/types/data";

const SOURCES: WeatherSourceId[] = ["cchain", "open_meteo"];
/** Weeks drawn in the chart, ending at the selected week. */
const CHART_WEEKS = 156;

/**
 * One CCHAIN city in the ENVIRONMENT mode: every variable for the selected
 * week from both sources side by side, three years of the selected variable
 * with each source as its own line, coverage, and the caveats.
 */
export function EnvironmentDetailPanel({
  data,
  geographyId,
  variable,
  week,
  onClose,
}: {
  data: EnvironmentBundle;
  geographyId: string;
  variable: WeatherVariable;
  /** ISO week start (the timeline slice key). */
  week: string | undefined;
  onClose: () => void;
}) {
  const geo = data.geographies.find((g) => g.id === geographyId);
  const series = useMemo(
    () => Object.fromEntries(SOURCES.map((s) => [s, findSeries(data, geographyId, s)])),
    [data, geographyId],
  ) as Record<WeatherSourceId, ReturnType<typeof findSeries>>;
  const meta = WEATHER_VARIABLE_META[variable];

  const chart = useMemo(() => {
    if (!week) return [];
    const rows = [];
    for (let n = CHART_WEEKS - 1; n >= 0; n--) {
      const w = addDays(week, -7 * n);
      const row: Record<string, string | number | null> = { week: w };
      for (const source of SOURCES) {
        const s = series[source];
        const i = s ? weekIndex(s, w) : -1;
        const value = i >= 0 && s ? s.values[variable][i] : null;
        const provisional = i >= 0 && s ? qcFlagsAt(s, i).includes("provisional_era5t") : false;
        row[source] = provisional ? null : value;
        if (source === "open_meteo") row.provisional = provisional ? value : null;
      }
      rows.push(row);
    }
    // Join the provisional segment to the last final week so the line reads as one series.
    const first = rows.findIndex((r) => r.provisional !== null);
    if (first > 0 && rows[first - 1].open_meteo !== null) rows[first - 1].provisional = rows[first - 1].open_meteo;
    return rows;
  }, [series, variable, week]);

  const yearTicks = useMemo(
    () => chart.map((r) => r.week as string).filter((w, i, all) => i > 0 && w.slice(0, 4) !== all[i - 1].slice(0, 4)),
    [chart],
  );

  if (!geo) return null;
  const hasProvisional = chart.some((r) => r.provisional !== null);

  return (
    <div>
      <div className="flex items-start justify-between border-b border-slate-200 p-4">
        <div>
          <p className="text-[11px] font-medium text-slate-400">PSGC {geo.psgcCode}</p>
          <h3 className="text-base font-semibold text-slate-900">{geo.name}</h3>
          <p className="text-xs text-slate-500">{RELATION_LABEL[geo.hdxUnitRelation]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {week && (
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Week of {formatIsoDate(week)}
            </p>
            <EvidenceBadge kind="context" />
          </div>
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-0.5 font-normal">Variable</th>
                {SOURCES.map((s) => (
                  <th key={s} className="py-0.5 text-right font-normal">
                    {WEATHER_SOURCE_LABEL[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(WEATHER_VARIABLE_META) as WeatherVariable[]).map((v) => (
                <tr key={v} className={v === variable ? "font-semibold text-slate-900" : "text-slate-700"}>
                  <td className="py-0.5">{WEATHER_VARIABLE_META[v].label}</td>
                  {SOURCES.map((source) => {
                    const s = series[source];
                    const i = s ? weekIndex(s, week) : -1;
                    const value = i >= 0 && s ? s.values[v][i] : null;
                    return (
                      <td key={source} className="py-0.5 text-right tabular-nums">
                        {i < 0 ? "—" : value === null ? "No data" : WEATHER_VARIABLE_META[v].format(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {SOURCES.map((source) => {
            const s = series[source];
            const i = s ? weekIndex(s, week) : -1;
            const flags = i >= 0 && s ? qcFlagsAt(s, i) : [];
            return flags.length > 0 ? (
              <p key={source} className="mt-1 text-[11px] text-amber-700">
                {WEATHER_SOURCE_LABEL[source]}: {flags.map((f) => QC_FLAG_LABEL[f]).join("; ")}
              </p>
            ) : null;
          })}
        </div>
      )}

      <div className="border-b border-slate-200 px-2 pb-2 pt-3">
        <p className="px-2 text-xs font-medium text-slate-700">
          {meta.label} ({meta.unit}), 3 years to the selected week
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 px-2 pt-1 text-[11px] text-slate-600">
          {SOURCES.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ background: WEATHER_SOURCE_HEX[s] }} aria-hidden="true" />
              {WEATHER_SOURCE_LABEL[s]}
            </li>
          ))}
          {hasProvisional && (
            <li className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ background: WEATHER_SOURCE_HEX.provisional }} aria-hidden="true" />
              Provisional (ERA5T)
            </li>
          )}
        </ul>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="week"
              ticks={yearTicks}
              tickFormatter={(iso: string) => iso.slice(0, 4)}
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<ChartTooltip />} />
            {week && <ReferenceLine x={week} stroke="#0f172a" strokeDasharray="3 3" />}
            {SOURCES.map((s) => (
              <Line
                key={s}
                dataKey={s}
                name={WEATHER_SOURCE_LABEL[s]}
                stroke={WEATHER_SOURCE_HEX[s]}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            <Line
              dataKey="provisional"
              name="Open-Meteo, provisional"
              stroke={WEATHER_SOURCE_HEX.provisional}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="px-2 text-[10px] leading-snug text-slate-400">
          Each source is its own line and is never joined to the other. Breaks are incomplete weeks (no data).{" "}
          {COMPARABILITY_LABEL[data.comparability[variable]]}.
        </p>
      </div>

      <dl className="space-y-1 border-b border-slate-200 px-4 py-3 text-xs">
        {SOURCES.map((source) => {
          const s = series[source];
          return (
            <div key={source} className="flex justify-between gap-3">
              <dt className="text-slate-400">{WEATHER_SOURCE_LABEL[source]} coverage</dt>
              <dd className="text-right text-slate-700">
                {s ? `${formatIsoDate(s.coverageStart)} – ${formatIsoDate(s.coverageEnd)}` : "Not covered"}
              </dd>
            </div>
          );
        })}
        {series.open_meteo?.gridCell && (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Open-Meteo grid cell</dt>
            <dd className="text-right text-slate-700">{series.open_meteo.gridCell}</dd>
          </div>
        )}
      </dl>

      <div className="space-y-1.5 px-4 py-3 text-[11px] leading-snug text-slate-500">
        <p className="font-medium text-amber-800">{ENVIRONMENT_NOTE}</p>
        {geo.hdxUnitRelation === "inside_unit" && (
          <p>
            This city is inside a larger HDX dengue reporting unit, so its weather must not be compared with that
            unit&apos;s case counts.
          </p>
        )}
        <p className="text-slate-400">
          Sources: {SOURCES.map((s) => `${data.sources[s].name} (${data.sources[s].license})`).join("; ")}.{" "}
          {data.weekConvention}.
        </p>
      </div>
    </div>
  );
}
