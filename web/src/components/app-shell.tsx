"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", module: "ACT" },
  { href: "/lab", label: "Trace", module: "Signal intake" },
  { href: "/explore", label: "Analyze", module: "Patterns & clusters" },
  { href: "/simulate", label: "Simulate", module: "Scenarios" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
            Σ
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-slate-900">
              SIGMA
            </p>
            <p className="text-[11px] text-slate-500">Public-health intel</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className="block font-medium">{item.label}</span>
                <span
                  className={`block text-[11px] ${
                    isActive ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {item.module}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 px-4 py-4 text-[11px] text-slate-400">
          Scaffold build · no live data
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <p className="text-sm font-medium text-slate-500">
            Spatial Intelligence &amp; Geographic Modeling for Action
          </p>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
            Placeholder data
          </span>
        </header>

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
