"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ANALYZE_TABS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * The secondary navigation inside Analyze. ACCESS leads the tabs once its
 * real-data integration is ready; until then it is listed last and marked
 * as not yet available, so it is never presented as a working feature.
 */
export function AnalyzeTabs({ accessReady }: { accessReady: boolean }) {
  return (
    <Suspense fallback={<TabList accessReady={accessReady} query="" />}>
      <TabsWithQuery accessReady={accessReady} />
    </Suspense>
  );
}

/** The links keep the page's ?unit=&compare=, so the place (and SIGI's conversation) survive a tab switch. */
function TabsWithQuery({ accessReady }: { accessReady: boolean }) {
  const query = useSearchParams().toString();
  return <TabList accessReady={accessReady} query={query} />;
}

function TabList({ accessReady, query }: { accessReady: boolean; query: string }) {
  const pathname = usePathname();
  const tabs = accessReady
    ? ANALYZE_TABS
    : [...ANALYZE_TABS.filter((t) => t.id !== "access"), ...ANALYZE_TABS.filter((t) => t.id === "access")];

  return (
    <nav aria-label="Analyze" className="scroll-row -mx-4 mb-6 border-b border-border px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const pending = tab.id === "access" && !accessReady;
          const Icon = tab.icon;
          return (
            <li key={tab.id}>
              <Link
                href={query ? `${tab.href}?${query}` : tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors md:min-h-10",
                  active
                    ? "border-accent text-ink"
                    : "border-transparent text-slate-500 hover:border-control hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                {tab.label}
                {pending && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
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
