import { cn } from "@/lib/utils";

/**
 * The four evidence categories a reader must never confuse. Every view that
 * shows data states which one it is showing.
 */
export type EvidenceKind = "formal" | "signal" | "model" | "context";

export const EVIDENCE_CONFIG: Record<
  EvidenceKind,
  { label: string; description: string; className: string; dotClass: string }
> = {
  formal: {
    label: "Formal",
    description: "Reported health observations from a surveillance source",
    className: "bg-teal-50 text-teal-800 ring-teal-200",
    dotClass: "bg-teal-600",
  },
  signal: {
    label: "Signal",
    description: "Open-source event reports; not confirmed cases",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
    dotClass: "bg-amber-500",
  },
  model: {
    label: "Model",
    description: "Model or scenario output; not an observation or a diagnosis",
    className: "bg-violet-50 text-violet-800 ring-violet-200",
    dotClass: "bg-violet-500",
  },
  context: {
    label: "Context",
    description: "Environmental or access covariates that inform, not measure, disease",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    dotClass: "bg-slate-400",
  },
};

export function EvidenceBadge({
  kind,
  className,
}: {
  kind: EvidenceKind;
  className?: string;
}) {
  const config = EVIDENCE_CONFIG[kind];
  return (
    <span
      title={config.description}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
        config.className,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} aria-hidden="true" />
      {config.label}
    </span>
  );
}
