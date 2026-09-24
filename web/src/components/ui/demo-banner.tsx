import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function DemoBanner({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800",
        className,
      )}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p>
        {message ??
          "Using illustrative sample data. Live public-health sources are not connected in this prototype."}
      </p>
    </div>
  );
}
