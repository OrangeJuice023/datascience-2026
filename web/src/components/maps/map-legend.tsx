import { SIGNAL_STATUS_CONFIG } from "@/lib/status";
import type { SignalStatus } from "@/types";

export function MapLegend({
  statuses = ["normal", "watch", "elevated"],
}: {
  statuses?: SignalStatus[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      {statuses.map((status) => {
        const config = SIGNAL_STATUS_CONFIG[status];
        return (
          <span key={status} className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${config.dotClass}`}
              aria-hidden="true"
            />
            {config.label}
          </span>
        );
      })}
    </div>
  );
}
