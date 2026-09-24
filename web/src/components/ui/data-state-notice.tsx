import type { ReactNode } from "react";
import { AlertTriangle, CircleDashed, DatabaseZap, Info, Loader2, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Explicit data states. Limitations are shown, not hidden: a partial record
 * or an unfitted model gets its own visible notice instead of a silent gap
 * or a placeholder number.
 */
export type DataState =
  | "loading"
  | "no-data"
  | "partial-coverage"
  | "quality-warning"
  | "source-unavailable"
  | "model-not-fitted";

const CONFIG: Record<DataState, { title: string; icon: typeof Info; className: string; iconClass: string }> = {
  loading: {
    title: "Loading",
    icon: Loader2,
    className: "border-slate-200 bg-white text-slate-600",
    iconClass: "animate-spin text-slate-400",
  },
  "no-data": {
    title: "No data",
    icon: SearchX,
    className: "border-slate-200 bg-slate-50 text-slate-600",
    iconClass: "text-slate-400",
  },
  "partial-coverage": {
    title: "Partial coverage",
    icon: Info,
    className: "border-sky-200 bg-sky-50 text-sky-900",
    iconClass: "text-sky-600",
  },
  "quality-warning": {
    title: "Data quality note",
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-900",
    iconClass: "text-amber-600",
  },
  "source-unavailable": {
    title: "Source unavailable",
    icon: DatabaseZap,
    className: "border-rose-200 bg-rose-50 text-rose-900",
    iconClass: "text-rose-600",
  },
  "model-not-fitted": {
    title: "Model not yet fitted",
    icon: CircleDashed,
    className: "border-violet-200 bg-violet-50 text-violet-900",
    iconClass: "text-violet-500",
  },
};

export function DataStateNotice({
  state,
  title,
  children,
  className,
}: {
  state: DataState;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const config = CONFIG[state];
  const Icon = config.icon;
  return (
    <div
      role={state === "source-unavailable" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs", config.className, className)}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconClass)} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold">{title ?? config.title}</p>
        {children && <div className="mt-0.5 leading-relaxed opacity-90">{children}</div>}
      </div>
    </div>
  );
}
