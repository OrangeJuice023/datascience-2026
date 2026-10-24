"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ANALYZE_TABS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * The secondary navigation inside Analyze. ACCESS leads the tabs once its
 * real-data integration is ready; until then it is listed last and marked
 * as not yet available, so it is never presented as a working feature.
 */
export function AnalyzeTabs({ accessReady }: { accessReady: boolean }) {
  const pathname = usePathname();
  const tabs = accessReady
    ? ANALYZE_TABS
    : [...ANALYZE_TABS.filter((t) => t.id !== "access"), ...ANALYZE_TABS.filter((t) => t.id === "access")];

  return (
    <nav aria-label="Analyze" className="-mx-4 mb-6 overflow-x-auto border-b border-slate-200 px-4 sm:-mx-6 sm:px-6">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const pending = tab.id === "access" && !accessReady;
          const Icon = tab.icon;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {tab.label}
                {pending && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                    Not yet available
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
