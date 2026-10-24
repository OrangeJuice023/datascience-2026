import { formatCount, formatIsoDate } from "@/lib/map/format";
import { FIRST_SIGNAL_LABEL, type UnitYearRow } from "@/lib/sigma/lab";
import { cn } from "@/lib/utils";

/** Week date without the year, unless it falls in the previous calendar year (epi week 1 can start in late December). */
function weekDate(iso: string, epiYear: number): string {
  return Number(iso.slice(0, 4)) === epiYear
    ? formatIsoDate(iso, { month: "short", day: "numeric" })
    : formatIsoDate(iso);
}

function firstSignalText(row: UnitYearRow): string {
  const label = FIRST_SIGNAL_LABEL[row.firstSignal];
  if (row.firstSignal === "ears-first" && row.leadWeeks !== null) return `${label}, ${row.leadWeeks} wk earlier`;
  if (row.firstSignal === "doh-first" && row.leadWeeks !== null) return `${label}, ${-row.leadWeeks} wk earlier`;
  return label;
}

/**
 * Per epi year for one reporting unit: reported cases over usable weeks, EARS
 * alarm weeks, DOH-threshold weeks, and which of the two flagged first.
 */
export function UnitYearTable({ rows }: { rows: UnitYearRow[] }) {
  const partial = rows.some((r) => r.weeks < r.weeksInYear);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-b border-border text-xs font-medium text-slate-500">
              <th scope="col" className="py-2 pr-3">Epi year</th>
              <th scope="col" className="py-2 pr-3">Weeks with data</th>
              <th scope="col" className="py-2 pr-3 text-right">Reported cases</th>
              <th scope="col" className="py-2 pr-3 text-right">EARS alarm weeks</th>
              <th scope="col" className="py-2 pr-3 text-right">DOH alert / epidemic weeks</th>
              <th scope="col" className="py-2 pr-3">First EARS alarm</th>
              <th scope="col" className="py-2 pr-3">First DOH-threshold week</th>
              <th scope="col" className="py-2">Which came first</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {rows.map((r) => {
              const noDoh = r.dohEvaluatedWeeks === 0;
              return (
                <tr key={r.year} className="align-top">
                  <th scope="row" className="py-2 pr-3 font-medium tabular-nums text-slate-800">
                    {r.year}
                    {r.weeks < r.weeksInYear && <span className="ml-0.5 text-slate-400">*</span>}
                  </th>
                  <td className="py-2 pr-3 tabular-nums text-slate-700">
                    {r.usableWeeks} of {r.weeks}
                    {(r.missingWeeks > 0 || r.swapWeeks > 0) && (
                      <span className="block text-xs text-slate-400">
                        {[
                          r.missingWeeks > 0 && `${r.missingWeeks} missing`,
                          r.swapWeeks > 0 && `${r.swapWeeks} suspect swap`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-800">
                    {r.reportedCases === null ? <span className="text-slate-400">No data</span> : formatCount(r.reportedCases)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-800">
                    {r.earsAlarmWeeks}
                    <span className="block text-xs text-slate-400">of {r.earsEvaluatedWeeks} with a result</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-800">
                    {noDoh ? (
                      <span className="text-slate-400">No threshold</span>
                    ) : (
                      <>
                        {r.dohAlertWeeks} / {r.dohEpidemicWeeks}
                        <span className="block text-xs text-slate-400">of {r.dohEvaluatedWeeks} compared</span>
                      </>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-slate-700">
                    {r.firstEarsAlarm ? weekDate(r.firstEarsAlarm, r.year) : <span className="text-slate-400">None</span>}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-slate-700">
                    {noDoh ? (
                      <span className="text-slate-400">n/a</span>
                    ) : r.firstDohCrossing ? (
                      weekDate(r.firstDohCrossing, r.year)
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "py-2",
                      noDoh ? "text-slate-400" : "font-medium text-slate-800",
                    )}
                  >
                    {firstSignalText(r)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 space-y-1 text-xs leading-snug text-slate-400">
        <p>
          Reported cases are the sum of the weeks with data; missing and suspect-swap weeks are left out, not
          counted as zero, so a year with gaps has no annual total.
          {partial && " * The export covers only part of this epi year."}
        </p>
        <p>
          DOH thresholds need the same week in three earlier years, so they start in 2019. &ldquo;Which came
          first&rdquo; compares only the first EARS alarm week and the first week above a DOH threshold within
          the epi year. EARS compares a week with the few weeks before it and DOH with the same week in
          earlier years, so an earlier first alarm is not by itself evidence of earlier warning.
        </p>
      </div>
    </div>
  );
}
