import { SIGNAL_STATUS_CONFIG } from "@/lib/status";
import type { SignalStatus } from "@/types";
import { cn } from "@/lib/utils";

export function SignalBadge({
  status,
  className,
}: {
  status: SignalStatus;
  className?: string;
}) {
  const config = SIGNAL_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        config.bgClass,
        config.textClass,
        config.ringClass,
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}
