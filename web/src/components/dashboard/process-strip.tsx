import Link from "next/link";
import { ArrowRight } from "lucide-react";

const STEPS = [
  { key: "Trace", title: "Find the signal.", href: "/lab", page: "Lab" },
  { key: "Analyze", title: "Understand the pattern.", href: "/explore", page: "Explore" },
  { key: "Simulate", title: "Explore the trajectory.", href: "/simulate", page: "Simulate" },
  { key: "Act", title: "Support verification and decision-making.", href: "/policy", page: "Policy" },
] as const;

/** The four steps of SIGMA's workflow, each linking to the page that does it. Order is the reading order. */
export function ProcessStrip() {
  return (
    <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((step) => (
        <li key={step.key} className="bg-sheet">
          <Link
            href={step.href}
            className="group flex h-full flex-col gap-1 px-4 py-3.5 transition-colors hover:bg-slate-50"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{step.key}</span>
              <span className="flex items-center gap-1 text-xs text-slate-500 group-hover:text-accent">
                {step.page}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </span>
            <span className="text-[13px] text-slate-600">{step.title}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
