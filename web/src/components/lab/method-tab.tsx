import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { DataStateNotice } from "@/components/ui/data-state-notice";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { StatCard, StatStrip } from "@/components/ui/stat-card";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import { FIRST_SIGNALS, FIRST_SIGNAL_LABEL, type SigmaLabSummary } from "@/lib/sigma/lab";

const shortDate = (iso: string) => formatIsoDate(iso, { month: "short", day: "numeric" });

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-slate-400">{label}</dt>
      <dd className="min-w-0 text-slate-700">{children}</dd>
    </div>
  );
}

/**
 * How the reporting-unit results are made and what the data can and cannot
 * support. Thresholds, the DOH rule and the assumptions are read from the
 * export's meta, and every count is computed from the export.
 */
export function MethodTab({ summary }: { summary: SigmaLabSummary }) {
  const { meta, quality: q } = summary;
  const t = meta.ears;
  const dohYear = q.dohFirstYear;
  const signals = FIRST_SIGNALS.filter((s) => s !== "no-doh-threshold");

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <p className="text-sm font-semibold text-ink">Two ways of flagging an unusual week</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          For each of the {summary.units.length} HDX DOH reporting units, SIGMA checks every week in two ways. EARS
          asks whether this week is unusual compared with the few weeks just before it. The DOH threshold asks
          whether it is unusual compared with the same week in earlier years. Both were computed offline by the{" "}
          <code className="font-mono text-[0.92em]">ml/</code> pipeline on historical data ({formatIsoDate(summary.firstWeek)} –{" "}
          {formatIsoDate(summary.lastWeek)}). {meta.description}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">EARS C1, C2 and C3</p>
            <EvidenceBadge kind="model" />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            CDC Early Aberration Reporting System methods. Quick to react and needs little history, but any sharp
            rise can alarm.
          </p>
          <dl className="mt-2 divide-y divide-rule text-xs">
            <Row label="C1">
              This week against the {t.baselineWeeks} weeks before it: (cases − mean) ÷ SD. Alarm above{" "}
              {t.c1c2Threshold}.
            </Row>
            <Row label="C2">
              The same, with a 2-week gap before the {t.baselineWeeks}-week baseline. Alarm above {t.c1c2Threshold}.
            </Row>
            <Row label="C3">
              How far C2 exceeded 1, summed over this week and the 2 before. Alarm above {t.c3Threshold}.
            </Row>
            <Row label="Baseline">
              At least {t.minBaseline} of the {t.baselineWeeks} baseline weeks must have data, or there is no
              result. Flagged weeks get a result but are left out of other weeks&apos; baselines.
            </Row>
            <Row label="Small counts">A week needs at least {t.minCount} cases to raise an alarm.</Row>
            <Row label="No result">
              {formatCount(q.earsNotComputed)} unit-weeks with data have no EARS result (too few usable baseline
              weeks), mostly in early 2016, at the start of the series, and in the weeks after the suspect-swap gaps.
            </Row>
          </dl>
          <p className="mt-2 text-xs text-slate-400">Implementation: ml/ears.py.</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">DOH alert and epidemic thresholds</p>
            <EvidenceBadge kind="model" />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            The rule in the DOH surveillance manual. Accounts for the season, but needs years of history.
          </p>
          <dl className="mt-2 divide-y divide-rule text-xs">
            <Row label="Rule">{meta.doh}</Row>
            <Row label="Start">
              Three earlier years are needed, so thresholds start in {dohYear ?? "no year of this export"}
              {q.dohFirstWeek && ` (first week ${formatIsoDate(q.dohFirstWeek)})`}. Weeks before that have no DOH
              comparison.
            </Row>
            <Row label="Gaps">
              A baseline year without data for that week is dropped and the threshold uses the other two; with fewer
              than two there is no threshold ({formatCount(q.dohNoBaseline)} unit-weeks from {dohYear ?? "then"} on).
              Week 53 uses week 52 of baseline years that have no week 53.
            </Row>
            <Row label="No data">A week without data keeps its thresholds but is not compared with them.</Row>
          </dl>
          <p className="mt-2 text-xs text-slate-400">Implementation: ml/clean_dengue.py.</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Data quality</p>
          <EvidenceBadge kind="formal" />
        </div>
        <StatStrip columns={4} className="mt-3">
          <StatCard
            label="Unit-weeks"
            value={formatCount(q.unitWeeks)}
            hint={`${summary.units.length} units × ${summary.weekCount} weeks`}
          />
          <StatCard label="With data" value={formatCount(q.usable)} hint="Usable in every calculation" />
          <StatCard label="Missing" value={formatCount(q.missing)} hint="No record for the week: no data" tone="muted" />
          <StatCard
            label="Suspect swap"
            value={formatCount(q.suspectSwap)}
            hint="Cases and deaths look swapped: no data"
            tone="muted"
          />
        </StatStrip>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-700">Suspect cases/deaths swap rows</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-500">
              In these rows the suspected-cases and deaths columns look swapped in the source. They are treated as
              no data: never zero, and never swapped back, because the true values cannot be confirmed.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {q.swapByYear.map((y) => (
                <li key={y.year} className="tabular-nums">
                  <span className="font-medium">{y.year}</span>: {y.rows} rows, {y.units} units, weeks of{" "}
                  {y.weeks.map(shortDate).join(", ")}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-700">Missing weeks</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-500">
              Missing weeks stay empty: they are not zero-filled or interpolated, and they break the line in every
              chart.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {q.emptyWeeks.length > 0 && (
                <li>
                  No unit has data for the week of {q.emptyWeeks.map((w) => formatIsoDate(w)).join(", ")}.
                </li>
              )}
              {q.sharedMissingWeeks.filter((w) => !q.emptyWeeks.includes(w.week)).length > 0 && (
                <li>
                  Also missing for several units:{" "}
                  {q.sharedMissingWeeks
                    .filter((w) => !q.emptyWeeks.includes(w.week))
                    .map((w) => `${formatIsoDate(w.week)} (${w.units} units)`)
                    .join(", ")}
                  .
                </li>
              )}
              <li>
                Missing weeks per unit:{" "}
                {q.missingPerUnit
                  .map((g) =>
                    `${g.missingWeeks} wk: ${g.names.length ? g.names.join(", ") : `${g.units} units`}`,
                  )
                  .join(" · ")}
                .
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <DataStateNotice state="quality-warning" title="Flagged weeks keep their published values">
            {Object.entries(q.flagged)
              .map(([flag, n]) => `${formatCount(n)} unit-weeks flagged “${flag}”`)
              .join(" and ")}
            . Possible non-reporting: part of a run of 4+ zero weeks where a unit usually reports 10+ cases. One-week
            spike: at least 30 cases, over 8× the unit&apos;s 9-week rolling median and 4× both neighbouring weeks (a
            possible backlog or entry error). True counts for these weeks cannot be recovered from the data.
          </DataStateNotice>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-ink">Assumptions behind every result</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
          <li>{meta.weekNote}</li>
          {meta.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
          <li>
            Reporting units are not all provinces: a province remainder is the province minus its separately
            reported cities, not the whole province.
          </li>
        </ul>
        <p className="mt-2 text-xs text-slate-400">Source: {meta.source}.</p>
      </Card>

      {summary.firstSignalByYear.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Across all reporting units: which came first</p>
            <EvidenceBadge kind="model" />
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Number of units per epi year, comparing the first EARS alarm week with the first week above a DOH
            threshold. Only years with DOH thresholds.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-slate-500">
                  <th scope="col" className="py-2 pr-3">Epi year</th>
                  {signals.map((s) => (
                    <th key={s} scope="col" className="py-2 pr-3 text-right">
                      {FIRST_SIGNAL_LABEL[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {summary.firstSignalByYear.map((y) => (
                  <tr key={y.year}>
                    <th scope="row" className="py-2 pr-3 font-medium tabular-nums text-slate-800">
                      {y.year}
                      {y.weeks < y.weeksInYear && (
                        <span className="ml-1 font-normal text-slate-400">
                          ({y.weeks} of {y.weeksInYear} weeks in the export)
                        </span>
                      )}
                    </th>
                    {signals.map((s) => (
                      <td key={s} className="py-2 pr-3 text-right tabular-nums text-slate-800">
                        {y.counts[s]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs leading-snug text-slate-400">
            Descriptive only. The two methods ask different questions, an alarm is not a confirmed outbreak, and this
            comparison has not been validated against any outbreak record.
          </p>
        </Card>
      )}
    </div>
  );
}
