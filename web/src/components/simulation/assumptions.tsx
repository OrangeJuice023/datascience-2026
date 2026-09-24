"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Historical trends for the selected disease and location",
  "Neighboring-area relationships and spatial coupling",
  "Temporal persistence of recent activity",
  "Reporting delays in underlying data sources",
  "Configurable intervention assumptions",
];

export function AssumptionsSection() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700"
      >
        Assumptions
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="border-t border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">
            A future, validated model may incorporate:
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            {ASSUMPTIONS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
