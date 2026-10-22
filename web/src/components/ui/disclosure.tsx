import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A collapsible section built on <details>/<summary>, so it is keyboard and
 * screen-reader accessible without script and keeps its content in the page
 * (find-in-page and links into it still work).
 *
 * Use it for supporting detail that a reader may need but should not have to
 * scroll past: provenance, diagnostics, comparison tables.
 */
export function Disclosure({
  title,
  summary,
  badge,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  /** One line shown next to the title while collapsed. */
  summary?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn("group rounded-lg border border-slate-200 bg-white", className)}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-lg px-4 py-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          aria-hidden="true"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{title}</span>
            {badge}
          </span>
          {summary && <span className="text-xs text-slate-500">{summary}</span>}
        </span>
      </summary>
      <div className="border-t border-slate-100 px-4 py-4">{children}</div>
    </details>
  );
}
