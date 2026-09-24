import type { ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { LGU, NeighborSummary, Signal } from "@/types";
import type { TrendPoint } from "@/types";
import { SignalBadge } from "@/components/ui/signal-badge";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/charts/sparkline";
import { TrendChart } from "@/components/charts/trend-chart";
import { DEMO_SOURCES, SOURCE_CATEGORY_LABEL, sourceBreakdown } from "@/data/demo-sources";
import { cn, formatMultiplier, formatSignedPercent } from "@/lib/utils";
import type { SourceCategory } from "@/types";

export function LocationDetailPanel({
  lgu,
  signal,
  trend,
  neighbors,
  onClose,
  summary,
}: {
  lgu: LGU;
  signal: Signal;
  trend: TrendPoint[];
  neighbors: NeighborSummary[];
  onClose: () => void;
  /** Optional block under the header, e.g. the active map mode's readout. */
  summary?: ReactNode;
}) {
  const elevatedNeighbors = neighbors.filter((n) => n.status === "elevated").length;
  const breakdown = sourceBreakdown(DEMO_SOURCES);

  return (
    <div className="flex h-full max-h-[42rem] flex-col overflow-y-auto xl:max-h-[48rem]">
      <div className="flex items-start justify-between border-b border-slate-200 p-4">
        <div>
          <p className="text-[11px] font-medium text-slate-400">{lgu.province}</p>
          <h3 className="text-base font-semibold text-slate-900">{lgu.name}</h3>
          <p className="text-sm text-slate-500">{signal.disease}</p>
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

      {summary}

      <div className="grid grid-cols-2 gap-4 p-4">
        <div>
          <p className="text-[11px] font-medium text-slate-400">Signal</p>
          <div className="mt-1">
            <SignalBadge status={signal.status} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-400">Current level</p>
          <p className="mt-1.5 text-sm font-semibold tabular-nums text-slate-800">
            {formatMultiplier(signal.signalLevel)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-400">Recent change</p>
          <p
            className={cn(
              "mt-1.5 text-sm font-semibold tabular-nums",
              signal.changePercent > 0 ? "text-rose-700" : "text-slate-600",
            )}
          >
            {formatSignedPercent(signal.changePercent)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-400">Sources</p>
          <p className="mt-1.5 text-sm font-semibold text-slate-800">
            {signal.sourceCount} unique sources
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        <p className="text-[11px] font-medium text-slate-400">Neighboring areas</p>
        <p className="mt-1 text-sm text-slate-700">{elevatedNeighbors} elevated</p>
      </div>

      <div className="border-t border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-600">Signal trend</p>
        <Sparkline data={trend} height={56} />
      </div>

      <div className="border-t border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-600">Historical context</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Observed vs. expected baseline
        </p>
        <TrendChart data={trend} height={160} />
      </div>

      <div className="border-t border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-600">Sources</p>
        <ul className="mt-2 space-y-1.5 text-xs">
          {(Object.keys(breakdown) as SourceCategory[]).map((category) => (
            <li key={category} className="flex items-center justify-between">
              <span className="text-slate-500">{SOURCE_CATEGORY_LABEL[category]}</span>
              <span className="tabular-nums font-medium text-slate-700">
                {breakdown[category]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-600">Nearby activity</p>
        <ul className="mt-2 space-y-2">
          {neighbors.map((neighbor) => (
            <li
              key={neighbor.locationId}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-slate-600">{neighbor.locationName}</span>
              <SignalBadge status={neighbor.status} />
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
        This interface presents signals for investigation and does not confirm
        an outbreak.
      </div>

      <div className="border-t border-slate-200 p-4">
        <Link href="/lab" className="block">
          <Button className="w-full">View in Lab</Button>
        </Link>
      </div>
    </div>
  );
}
