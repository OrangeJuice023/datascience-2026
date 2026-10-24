"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataStateNotice } from "@/components/ui/data-state-notice";
import { Disclosure } from "@/components/ui/disclosure";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { SelectFilter } from "@/components/ui/select-filter";
import { StatCard } from "@/components/ui/stat-card";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import { SIGMA_HEX, hexToRgba } from "@/lib/map/palette";
import { epiWeek } from "@/lib/national-observations";
import {
  SIGMA_DATA_URL,
  coverageOf,
  hasData,
  weekOf,
  type SigmaData,
  type SigmaUnitSeries,
} from "@/lib/sigma/data";
import { UNIT_TYPE_LABEL, summarizeUnitYears, type SigmaUnitOption } from "@/lib/sigma/lab";
import { cn } from "@/lib/utils";
import { BAND, UnitWeeklyChart } from "./unit-weekly-chart";
import { UnitYearTable } from "./unit-year-table";

/*
 * The full export (~1.2 MB) is fetched the first time this tab opens, not
 * bundled, and kept for the rest of the visit so switching tabs does not
 * fetch or parse it again.
 */
let loaded: SigmaData | null = null;
let request: Promise<SigmaData> | null = null;

function loadSigma(): Promise<SigmaData> {
  request ??= fetch(SIGMA_DATA_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<SigmaData>;
    })
    .then((data) => {
      loaded = data;
      return data;
    })
    .catch((error: unknown) => {
      request = null; // allow a retry
      throw error;
    });
  return request;
}

function useSigmaExport() {
  const [state, setState] = useState<{ data?: SigmaData; error?: string }>(() => (loaded ? { data: loaded } : {}));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (state.data || state.error) return;
    let live = true;
    loadSigma()
      .then((data) => live && setState({ data }))
      .catch((error: unknown) =>
        live && setState({ error: error instanceof Error ? error.message : "unknown error" }),
      );
    return () => {
      live = false;
    };
  }, [attempt, state.data, state.error]);

  return {
    ...state,
    retry: () => {
      setState({});
      setAttempt((n) => n + 1);
    },
  };
}

function Legend({ showThresholds }: { showThresholds: boolean }) {
  // Same tint as the chart's columns, with an edge so the pale swatch stays visible.
  const band = (fill: string, opacity: number) => {
    const [r, g, b] = hexToRgba(fill);
    return (
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ backgroundColor: `rgb(${r} ${g} ${b} / ${opacity})`, boxShadow: `inset 0 0 0 1px rgb(${r} ${g} ${b} / 0.7)` }}
      />
    );
  };
  const items = [
    { key: "cases", mark: <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: SIGMA_HEX.cases }} />, label: "Reported cases" },
    {
      key: "ears",
      mark: <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ backgroundColor: SIGMA_HEX.alarm }} />,
      label: "EARS alarm week",
    },
    { key: "alert", mark: band(BAND.alert.fill, BAND.alert.opacity), label: "Above DOH alert threshold" },
    { key: "epidemic", mark: band(BAND.epidemic.fill, BAND.epidemic.opacity), label: "Above DOH epidemic threshold" },
    { key: "nodata", mark: band(BAND.noData.fill, BAND.noData.opacity), label: "No data (missing or suspect swap)" },
    ...(showThresholds
      ? [
          {
            key: "lines",
            mark: (
              <span className="flex flex-col gap-0.5">
                <span className="block w-4 border-t border-dashed" style={{ borderColor: SIGMA_HEX.alert }} />
                <span className="block w-4 border-t border-dashed" style={{ borderColor: SIGMA_HEX.epidemic }} />
              </span>
            ),
            label: "DOH alert / epidemic threshold",
          },
        ]
      : []),
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="flex w-4 items-center justify-center">
            {item.mark}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function UnitDetail({ data, unit }: { data: SigmaData; unit: SigmaUnitSeries }) {
  const [year, setYear] = useState<number | null>(null);
  const [showThresholds, setShowThresholds] = useState(false);

  const rows = useMemo(() => summarizeUnitYears(data, unit), [data, unit]);
  const coverage = useMemo(() => coverageOf(data, unit), [data, unit]);
  const weeks = useMemo(() => data.meta.weeks.map((_, i) => weekOf(data, unit, i)), [data, unit]);

  const usable = weeks.filter(hasData);
  const peak = usable.reduce<(typeof usable)[number] | null>((m, w) => (!m || (w.value ?? 0) > (m.value ?? 0) ? w : m), null);
  const flagged = usable.filter((w) => w.flag);
  const nonReporting = flagged.filter((w) => w.flag === "possible non-reporting").length;
  const spikes = flagged.filter((w) => w.flag === "one-week spike").length;
  const total = rows.reduce(
    (t, r) => ({
      ears: t.ears + r.earsAlarmWeeks,
      earsEvaluated: t.earsEvaluated + r.earsEvaluatedWeeks,
      alert: t.alert + r.dohAlertWeeks,
      epidemic: t.epidemic + r.dohEpidemicWeeks,
      dohEvaluated: t.dohEvaluated + r.dohEvaluatedWeeks,
    }),
    { ears: 0, earsEvaluated: 0, alert: 0, epidemic: 0, dohEvaluated: 0 },
  );
  const excludedNames = unit.excludes.map((id) => data.units.find((u) => u.id === id)?.name ?? id);
  const visibleWeeks = year === null ? weeks : weeks.filter((w) => epiWeek(w.week).year === year);
  const firstYear = rows[0]?.year;
  const lastYear = rows[rows.length - 1]?.year;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-400">{unit.region}</p>
          <h3 className="text-base font-semibold text-slate-900">{unit.name}</h3>
          <p className="text-xs text-slate-500">{UNIT_TYPE_LABEL[unit.unitType] ?? unit.unitType}</p>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <EvidenceBadge kind="formal" /> reported cases
          <EvidenceBadge kind="model" className="ml-2" /> EARS and DOH-threshold results
        </p>
      </div>

      {excludedNames.length > 0 && (
        <DataStateNotice state="partial-coverage" title="Province remainder, not the whole province">
          This unit excludes {excludedNames.join(", ")}, which {excludedNames.length === 1 ? "is" : "are"} reported
          separately. Its counts are for the rest of the province only.
        </DataStateNotice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Weeks with data"
          value={`${coverage.ok} of ${data.meta.weeks.length}`}
          hint={`${coverage.missing} missing · ${coverage.suspectSwap} suspect swap (no data)`}
        />
        <StatCard
          label="Highest reported week"
          value={peak ? formatCount(peak.value ?? 0) : "No data"}
          hint={peak ? `Week of ${formatIsoDate(peak.week)}` : undefined}
          badge={<EvidenceBadge kind="formal" />}
        />
        <StatCard
          label="EARS alarm weeks"
          value={formatCount(total.ears)}
          hint={`of ${total.earsEvaluated} weeks with an EARS result`}
          badge={<EvidenceBadge kind="model" />}
        />
        <StatCard
          label="DOH alert / epidemic weeks"
          value={`${total.alert} / ${total.epidemic}`}
          hint={`of ${total.dohEvaluated} weeks compared (thresholds from 2019)`}
          badge={<EvidenceBadge kind="model" />}
        />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-600">Weekly reported cases</p>
            <p className="text-[11px] text-slate-400">
              {unit.name} · {year === null ? `${formatIsoDate(data.meta.weeks[0])} – ${formatIsoDate(data.meta.weeks[data.meta.weeks.length - 1])}` : `epi year ${year}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Range" className="flex flex-wrap gap-1">
              {[null, ...rows.map((r) => r.year)].map((y) => (
                <button
                  key={y ?? "all"}
                  type="button"
                  role="radio"
                  aria-checked={y === year}
                  onClick={() => setYear(y)}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium tabular-nums",
                    y === year ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {y ?? `${firstYear}–${lastYear}`}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showThresholds}
                onChange={(event) => setShowThresholds(event.target.checked)}
                className="h-3.5 w-3.5 accent-slate-900"
              />
              DOH threshold lines
            </label>
          </div>
        </div>
        <Legend showThresholds={showThresholds} />
        <div className="mt-2">
          <UnitWeeklyChart data={data} unit={unit} year={year} showThresholds={showThresholds} />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-400">
          Breaks in the line and grey columns are missing or suspect-swap weeks: no data, never zero. The axis is
          scaled to reported cases, so threshold lines above it run off the top. Hover a week for its EARS and DOH
          result and why.
        </p>
      </Card>

      {(nonReporting > 0 || spikes > 0) && (
        <DataStateNotice state="quality-warning" title="Flagged weeks">
          {[
            nonReporting > 0 &&
              `${nonReporting} week${nonReporting === 1 ? "" : "s"} flagged as possible non-reporting (part of a run of 4+ zero weeks where this unit usually reports 10+)`,
            spikes > 0 &&
              `${spikes} week${spikes === 1 ? "" : "s"} flagged as a one-week spike (a possible backlog or entry error)`,
          ]
            .filter(Boolean)
            .join("; ")}
          . Their values are kept as published and are left out of other weeks&apos; EARS baselines.
        </DataStateNotice>
      )}

      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-600">By epidemiological year</p>
        <p className="mb-2 text-[11px] text-slate-400">MMWR epi years (the year that holds the week&apos;s Wednesday).</p>
        <UnitYearTable rows={rows} />
      </Card>

      <Disclosure
        title="Weekly values"
        summary={`${visibleWeeks.length} weeks, ${year === null ? "whole export" : `epi year ${year}`}: the table behind the chart`}
      >
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                <th scope="col" className="py-1.5 pr-3">Week of</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Reported cases</th>
                <th scope="col" className="py-1.5 pr-3">EARS</th>
                <th scope="col" className="py-1.5">DOH threshold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleWeeks.map((w) => {
                const ok = hasData(w);
                return (
                  <tr key={w.week}>
                    <td className="py-1 pr-3 tabular-nums text-slate-600">{w.week}</td>
                    <td className="py-1 pr-3 text-right tabular-nums text-slate-800">
                      {ok ? formatCount(w.value ?? 0) : (
                        <span className="text-slate-400">{w.quality === "suspect swap" ? "No data (suspect swap)" : "No data (missing)"}</span>
                      )}
                    </td>
                    <td className={cn("py-1 pr-3", ok ? "text-slate-600" : "text-slate-400")}>{ok ? w.ears : "n/a"}</td>
                    <td className={cn("py-1", ok ? "text-slate-600" : "text-slate-400")}>{ok ? w.doh : "n/a"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Disclosure>

      <div className="space-y-1 text-[11px] leading-snug text-slate-500">
        <p className="font-medium text-amber-800">
          Retrospective prototype. EARS and DOH-threshold results show change relative to this unit&apos;s own
          history, not local risk or incidence, and are not a validated public-health claim.
        </p>
        <p>{data.meta.weekNote}</p>
        <ul className="list-disc space-y-0.5 pl-4">
          {data.meta.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Real reporting-unit analysis from the SIGMA export: pick one of the 126
 * HDX DOH reporting units and see its weekly cases, EARS alarms, DOH
 * threshold weeks and a per-year comparison.
 */
export function ReportingUnitsTab({
  units,
  unitId,
  onUnitChange,
}: {
  units: SigmaUnitOption[];
  unitId: string;
  onUnitChange: (id: string) => void;
}) {
  const sigma = useSigmaExport();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matches = q ? units.filter((u) => `${u.name} ${u.region}`.toLowerCase().includes(q)) : units;
  const selected = units.find((u) => u.id === unitId);
  const options = (selected && !matches.includes(selected) ? [selected, ...matches] : matches).map((u) => ({
    value: u.id,
    label: `${u.name} · ${u.region}`,
  }));
  const unit = sigma.data?.units.find((u) => u.id === unitId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full flex-col gap-1 sm:w-60">
          <label htmlFor="lab-unit-search" className="text-[11px] font-medium text-slate-500">
            Search reporting units
          </label>
          <input
            id="lab-unit-search"
            type="search"
            value={query}
            placeholder="Name or region, e.g. Cebu"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches[0]) onUnitChange(matches[0].id);
            }}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <div className="w-full sm:w-[26rem]">
          <SelectFilter label="Reporting unit" value={unitId} onChange={onUnitChange} options={options} />
        </div>
        <p className="pb-2 text-[11px] text-slate-400" aria-live="polite">
          {q ? `${matches.length} of ${units.length} units match` : `${units.length} HDX DOH reporting units`}
        </p>
      </div>

      {sigma.error ? (
        <DataStateNotice state="source-unavailable" title="Reporting-unit results could not be loaded">
          {sigma.error}. Nothing is shown rather than substitute values.{" "}
          <Button variant="secondary" className="mt-2 px-2.5 py-1 text-xs" onClick={sigma.retry}>
            Try again
          </Button>
        </DataStateNotice>
      ) : !sigma.data ? (
        <DataStateNotice state="loading" title="Loading reporting-unit results…" />
      ) : unit ? (
        <UnitDetail data={sigma.data} unit={unit} />
      ) : (
        <DataStateNotice state="no-data" title="No series for this unit">
          The export has no series for “{selected?.name ?? unitId}”.
        </DataStateNotice>
      )}
    </div>
  );
}
