import Link from "next/link";
import { Radar, LineChart, Waypoints, ShieldCheck } from "lucide-react";

const STEPS = [
  { key: "TRACE", title: "Find the signal.", href: "/lab", icon: Radar },
  { key: "ANALYZE", title: "Understand the pattern.", href: "/explore", icon: LineChart },
  { key: "SIMULATE", title: "Explore the trajectory.", href: "/simulate", icon: Waypoints },
  { key: "ACT", title: "Support verification and decision-making.", href: "/policy", icon: ShieldCheck },
] as const;

export function ProcessStrip() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        return (
          <Link
            key={step.key}
            href={step.href}
            className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-50 text-accent">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {String(i + 1).padStart(2, "0")} · {step.key}
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-800 group-hover:text-slate-900">
                {step.title}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
