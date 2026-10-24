"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { StatCard, StatStrip } from "@/components/ui/stat-card";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { DataStateNotice } from "@/components/ui/data-state-notice";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import type { NationalSummary } from "@/lib/national-observations";
import type { AnomalyResult } from "@/types/data";
import { WeeklyHistoryChart } from "./national/weekly-history-chart";
import { EpiYearChart } from "./national/epi-year-chart";
import { SeasonalProfileChart } from "./national/seasonal-profile-chart";
import { StreamChart, type StreamBar } from "./national/stream-chart";
import { BaselinePanel } from "./national/baseline-panel";

/** Serializable source metadata, as written by the fixture generator. */
export interface ObservationSourceMeta {
  source: string;
  version: string;
  extract: string;
  filter: string;
  upstreamUrl: string | null;
  citation: string;
  license: string;
  file: string;
  sha256: string;
  reconciliation: string;
  retrievedAt: string;
  recordedAt: string;
  generator: string;
}

const YEAR_TABS = [
  { id: "year-weekly", label: "Weekly, by epi year" },
  { id: "year-coverage", label: "Year coverage and totals" },
];

const CASE_DEFINITION_LABEL: Record<string, string> = {
  total: "Total",
  confirmed: "Confirmed",
  probable: "Probable",
  suspected: "Suspected",
  unspecified: "Unspecified",
};

/** The weekly-origin prefixes as they appear in OpenDengue record ids. */
const ORIGIN_NOTE: Record<string, string> = {
  WHOWPRO: "WHO Western Pacific weekly reports",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-slate-400">{label}</dt>
      <dd className="min-w-0 text-slate-700 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Weekly sums per epi year; a bar is an annual total only for complete years. */
function yearBars(national: NationalSummary): StreamBar[] {
  return national.weekly.epiYears.map((y) => ({
    key: String(y.year),
    label: String(y.year),
    value: y.recordedSum,
    complete: y.complete,
  }));
}

/**
 * Formal national observations. Every number here is computed from recorded
 * rows; limitations are stated next to the data they affect.
 */
export function NationalObservationsPanel({
  national,
  meta,
  anomalies,
}: {
  national: NationalSummary;
  meta: ObservationSourceMeta;
  anomalies: AnomalyResult[];
}) {
  const { weekly } = national;
  const [yearTab, setYearTab] = useState(YEAR_TABS[0].id);
  const [year, setYear] = useState(weekly.epiYears[weekly.epiYears.length - 1]?.year);
  const [showGaps, setShowGaps] = useState(false);

  if (weekly.recorded === 0) {
    return (
      <DataStateNotice state="no-data" title="No weekly observations available">
        The provider returned no weekly national records for dengue.
      </DataStateNotice>
    );
  }

  const missingWeeks = weekly.expected - weekly.recorded;
  const yearSummary = weekly.epiYears.find((y) => y.year === year);
  const yearWeeks = weekly.series.filter((p) => p.epiYear === year);
  const origins = weekly.originsByYear.reduce<Record<string, number>>((acc, y) => {
    for (const [k, v] of Object.entries(y.origins)) acc[k] = (acc[k] ?? 0) + v;
    return acc;
  }, {});
  const completeYears = weekly.epiYears.filter((y) => y.complete);
  const peakCompleteYear = completeYears.reduce<(typeof completeYears)[number] | null>(
    (m, y) => (!m || y.recordedSum > m.recordedSum ? y : m),
    null,
  );
  const bars = yearBars(national);
  const caseDefinition =
    national.caseDefinitions.map((c) => CASE_DEFINITION_LABEL[c] ?? c).join(", ") || "Unspecified";
  const firstYear = weekly.epiYears[0]?.year;
  const lastYear = weekly.epiYears[weekly.epiYears.length - 1]?.year;

  return (
    <div className="flex flex-col gap-4">
      {/* Evidence banner */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge kind="formal" />
          <p className="text-sm font-semibold text-ink">Formal observed data</p>
        </div>
        <p className="mt-1 text-sm text-slate-700">
          This is reported historical disease data, not model output.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="font-medium text-ink">Dengue</span>
          <span>Philippines · national</span>
          <span>National / Weekly</span>
          <span>
            {weekly.first!.slice(0, 4)}–{weekly.last!.slice(0, 4)}
          </span>
          <span>
            {meta.source} v{meta.version} · {meta.extract} · {meta.license}
          </span>
        </p>
      </Card>

      {/* Coverage */}
      <StatStrip columns={4}>
        <StatCard label="Earliest observation" value={formatIsoDate(weekly.first!)} hint="Week start" />
        <StatCard label="Latest observation" value={formatIsoDate(weekly.last!)} hint="Week end" />
        <StatCard
          label="Weekly observations"
          value={formatCount(weekly.recorded)}
          hint={`of ${formatCount(weekly.expected)} weeks in range`}
        />
        <StatCard label="Resolution" value="National · weekly" hint="No sub-national formal series used" />
      </StatStrip>

      {/* Summary statistics */}
      <section aria-label="Summary statistics" className="flex flex-col">
        <p className="text-sm font-semibold text-ink">Summary statistics</p>
        <p className="text-xs text-slate-500">
          Weekly figures use the {formatCount(weekly.recorded)} recorded weeks only; missing
          weeks are excluded, not counted as zero.
        </p>
        {weekly.stats && (
          <StatStrip columns={4} className="mt-3">
            <StatCard label="Mean weekly count" value={weekly.stats.mean.toLocaleString("en-US", { maximumFractionDigits: 1 })} />
            <StatCard label="Median weekly count" value={weekly.stats.median.toLocaleString("en-US", { maximumFractionDigits: 1 })} />
            <StatCard
              label="Maximum weekly count"
              value={formatCount(weekly.stats.max.value)}
              hint={`Peak week of ${formatIsoDate(weekly.stats.max.periodStart)}`}
            />
            <StatCard
              label="Minimum weekly count"
              value={formatCount(weekly.stats.min.value)}
              hint={`Week of ${formatIsoDate(weekly.stats.min.periodStart)}`}
            />
          </StatStrip>
        )}
        {completeYears.length > 0 && (
          <StatStrip columns={2} className="mt-3">
            <StatCard
              label="Complete epi years"
              value={String(completeYears.length)}
              hint={`${completeYears.map((y) => y.year).join(", ")} · every week recorded`}
            />
            {peakCompleteYear && (
              <StatCard
                label="Highest complete-year total"
                value={formatCount(peakCompleteYear.recordedSum)}
                hint={`${peakCompleteYear.year} · sum of ${peakCompleteYear.recordedWeeks} weeks`}
              />
            )}
          </StatStrip>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Annual totals are shown only for epi years with every week recorded; other years
          have partial sums, labelled as such.
        </p>
      </section>

      {/* Data quality / coverage */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-ink">Data quality and coverage</p>
        <div className="mt-2 grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
          <dl className="divide-y divide-rule text-xs">
            <Row label="Observations">
              {formatCount(weekly.recorded)} weekly (validated against the reconciliation)
            </Row>
            <Row label="Missing periods">
              {missingWeeks} weeks in {weekly.gaps.length} gaps{" "}
              <button
                type="button"
                onClick={() => setShowGaps((v) => !v)}
                aria-expanded={showGaps}
                className="font-medium text-accent hover:underline"
              >
                {showGaps ? "Hide" : "List"}
              </button>
              {showGaps && (
                <ul className="mt-1 space-y-0.5 text-slate-500">
                  {weekly.gaps.map((g) => (
                    <li key={g.from} className="tabular-nums">
                      {formatIsoDate(g.from)}
                      {g.to !== g.from && ` – ${formatIsoDate(g.to)}`} ({g.missingWeeks} wk)
                    </li>
                  ))}
                </ul>
              )}
            </Row>
            <Row label="Temporal resolution">Weekly (MMWR weeks, Sunday–Saturday)</Row>
            <Row label="Geographic resolution">National (Philippines) only</Row>
            <Row label="Source">
              {meta.source} v{meta.version}, {meta.extract}
            </Row>
            <Row label="Case definition">{caseDefinition} (as standardised upstream)</Row>
            <Row label="Upstream origin">
              {Object.entries(origins)
                .map(([k, v]) => `${k} ${v} wk${ORIGIN_NOTE[k] ? ` (${ORIGIN_NOTE[k]})` : ""}`)
                .join(" · ")}
            </Row>
          </dl>
          <div className="flex flex-col gap-2 lg:pt-1.5">
            <DataStateNotice state="partial-coverage">
              {missingWeeks} weeks between {firstYear} and {lastYear} have no weekly record,
              mostly around year-end. They appear as breaks in the charts, never as zero.
            </DataStateNotice>
            <DataStateNotice state="quality-warning">
              Weekly rows come from more than one upstream origin, which changes between years.
              Compare levels across origins with care. Per the reconciliation report, OpenDengue
              methods allow short gaps (up to 6 weeks) to be imputed upstream; this extract does
              not flag which weeks, if any, were imputed.
            </DataStateNotice>
          </div>
        </div>
      </Card>

      {/* Historical time series */}
      <Card className="p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">Reported dengue cases per week</p>
            <p className="text-xs text-slate-500">
              Philippines, national · {formatIsoDate(weekly.first!)} – {formatIsoDate(weekly.last!)} ·
              drag the handles below to zoom
            </p>
          </div>
          <EvidenceBadge kind="formal" />
        </div>
        <WeeklyHistoryChart series={weekly.series} />
      </Card>

      {/* Year view */}
      <Card>
        <Tabs items={YEAR_TABS} activeId={yearTab} onChange={setYearTab} />
        <div className="p-4">
          <TabPanel id="year-weekly" activeId={yearTab}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <SegmentedControl
                ariaLabel="Epidemiological year"
                size="sm"
                value={String(year)}
                onChange={(id) => setYear(Number(id))}
                items={weekly.epiYears.map((y) => ({
                  id: String(y.year),
                  title: `${y.recordedWeeks} of ${y.expectedWeeks} weeks recorded`,
                  label: (
                    <>
                      {y.year}
                      {!y.complete && <span className="-ml-1 opacity-60">*</span>}
                    </>
                  ),
                }))}
              />
              {yearSummary && (
                <p className="text-xs text-slate-500">
                  {yearSummary.recordedWeeks} of {yearSummary.expectedWeeks} weeks recorded ·{" "}
                  {yearSummary.complete ? (
                    <span className="font-medium text-ink">
                      Sum of all weeks: {formatCount(yearSummary.recordedSum)}
                    </span>
                  ) : yearSummary.truncated ? (
                    "record ends within this year; no annual total"
                  ) : (
                    "incomplete year; no annual total"
                  )}
                </p>
              )}
            </div>
            <EpiYearChart weeks={yearWeeks} />
            <p className="mt-2 text-xs text-slate-500">
              * Incomplete epi year. Shaded columns are weeks with no record.
            </p>
          </TabPanel>
          <TabPanel id="year-coverage" activeId={yearTab}>
            <p className="mb-2 text-xs text-slate-500">
              Sum of recorded weeks per MMWR epi year. Solid bars are complete years (an annual
              total); pale bars are partial sums over the weeks on record, not annual totals.
            </p>
            <StreamChart bars={bars} />
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-4">
              {weekly.epiYears.map((y) => (
                <li key={y.year} className="flex justify-between gap-2 tabular-nums">
                  <span className="text-slate-500">{y.year}</span>
                  <span className={y.complete ? "text-slate-800" : "text-slate-400"}>
                    {y.recordedWeeks}/{y.expectedWeeks} wk
                    {y.complete ? " · complete" : y.truncated ? " · record edge" : " · gaps"}
                  </span>
                </li>
              ))}
            </ul>
          </TabPanel>
        </div>
      </Card>

      {/* Seasonal view */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-ink">Seasonal profile by epidemiological week</p>
        <p className="mb-2 text-xs text-slate-500">
          Median and min–max across epi years with a record for that week (weekly rows only).
          Descriptive, not a baseline. Week 53 exists only in 53-week years.
        </p>
        <SeasonalProfileChart weeks={weekly.seasonal} />
      </Card>

      <BaselinePanel results={anomalies} />

      {/* Provenance */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-ink">Provenance</p>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 text-xs sm:grid-cols-2">
          <Row label="Source">{meta.source}</Row>
          <Row label="Release">
            v{meta.version} · {meta.extract}
          </Row>
          <Row label="Underlying records">OpenDengue record ids (e.g. WHOWPRO-…, MOH-…); shown per week on hover</Row>
          <Row label="Canonical file">{meta.file}</Row>
          <Row label="Upstream asset">{meta.upstreamUrl ?? "—"}</Row>
          <Row label="Reconciliation">{meta.reconciliation}</Row>
          <Row label="Citation">{meta.citation}</Row>
          <Row label="Filter">{meta.filter}</Row>
          <Row label="Retrieved">{meta.retrievedAt}</Row>
          <Row label="Case definition">{caseDefinition}</Row>
          <Row label="Resolution">National / Weekly</Row>
          <Row label="License">{meta.license}</Row>
          <Row label="Input SHA-256">
            <span className="break-all font-mono text-xs text-slate-600">{meta.sha256}</span>
          </Row>
        </dl>
      </Card>
    </div>
  );
}
