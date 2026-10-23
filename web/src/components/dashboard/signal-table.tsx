import type { Signal } from "@/types";
import { SignalBadge } from "@/components/ui/signal-badge";
import { EmptyState } from "@/components/ui/states";
import { formatShortDate, formatSignedPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

function changeClass(changePercent: number): string {
  return changePercent > 0 ? "text-rose-700" : "text-slate-500";
}

/**
 * Signals as a table from `sm` up, and as two-line rows on phones (the
 * identity and the status on line 1, the other fields on line 2), so no field
 * is dropped and the page never scrolls sideways.
 */
export function SignalTable({
  signals,
  layout = "responsive",
}: {
  signals: Signal[];
  /** "list" always uses the two-line rows (for narrow rails). */
  layout?: "responsive" | "list";
}) {
  const listOnly = layout === "list";
  if (signals.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <ul className={cn("divide-y divide-rule rounded-[var(--radius-card)] border border-border bg-sheet", !listOnly && "sm:hidden")}>
        {signals.map((signal) => (
          <li key={signal.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium text-ink">
                {signal.disease} · {signal.locationName}
              </p>
              <SignalBadge status={signal.status} />
            </div>
            <p className="text-[13px] tabular-nums text-slate-500">
              <span className={changeClass(signal.changePercent)}>{formatSignedPercent(signal.changePercent)}</span>
              {" · "}
              {signal.sourceCount} sources · {formatShortDate(signal.date)}
            </p>
          </li>
        ))}
      </ul>

      {!listOnly && (
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-border bg-sheet sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-slate-500">
              <th scope="col" className="px-4 py-2.5 font-normal">Disease or event</th>
              <th scope="col" className="px-4 py-2.5 font-normal">Location</th>
              <th scope="col" className="px-4 py-2.5 font-normal">Signal</th>
              <th scope="col" className="px-4 py-2.5 text-right font-normal">Change</th>
              <th scope="col" className="px-4 py-2.5 text-right font-normal">Sources</th>
              <th scope="col" className="px-4 py-2.5 text-right font-normal">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {signals.map((signal) => (
              <tr key={signal.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink">{signal.disease}</td>
                <td className="px-4 py-3 text-slate-600">{signal.locationName}</td>
                <td className="px-4 py-3">
                  <SignalBadge status={signal.status} />
                </td>
                <td className={cn("px-4 py-3 text-right tabular-nums", changeClass(signal.changePercent))}>
                  {formatSignedPercent(signal.changePercent)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{signal.sourceCount}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatShortDate(signal.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </>
  );
}
