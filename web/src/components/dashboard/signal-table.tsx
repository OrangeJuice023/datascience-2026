import type { Signal } from "@/types";
import { SignalBadge } from "@/components/ui/signal-badge";
import { EmptyState } from "@/components/ui/states";
import { formatShortDate, formatSignedPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function SignalTable({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-400">
            <th scope="col" className="px-4 py-3">Disease/Event</th>
            <th scope="col" className="px-4 py-3">Location</th>
            <th scope="col" className="px-4 py-3">Signal</th>
            <th scope="col" className="px-4 py-3">Change</th>
            <th scope="col" className="px-4 py-3">Source count</th>
            <th scope="col" className="px-4 py-3">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {signals.map((signal) => (
            <tr key={signal.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">
                {signal.disease}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {signal.locationName}
              </td>
              <td className="px-4 py-3">
                <SignalBadge status={signal.status} />
              </td>
              <td
                className={cn(
                  "px-4 py-3 tabular-nums",
                  signal.changePercent > 0 ? "text-rose-700" : "text-slate-500",
                )}
              >
                {formatSignedPercent(signal.changePercent)}
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-600">
                {signal.sourceCount}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {formatShortDate(signal.date)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
