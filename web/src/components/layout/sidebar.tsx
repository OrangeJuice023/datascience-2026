"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";
import { PRIMARY_NAV, SECONDARY_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function SidebarContent({
  onNavigate,
  logoSrc,
}: {
  onNavigate?: () => void;
  logoSrc?: string | null;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-5">
        <BrandMark size={32} src={logoSrc} />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-slate-900">
            SIGMA
          </p>
          <p className="text-[11px] text-slate-500">
            Public-health intelligence
          </p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          More
        </p>
        <ul className="mt-1 flex flex-col gap-1">
          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <span
                  className="flex cursor-not-allowed items-center justify-between gap-2.5 rounded-md px-3 py-2 text-sm text-slate-400"
                  title="Coming soon"
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                    Soon
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-200 px-4 py-4">
        <dl className="space-y-2 text-[11px]">
          <div className="flex items-center justify-between">
            <dt className="font-medium text-slate-400">Data status</dt>
            <dd className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-amber-200">
              Demo data
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-medium text-slate-400">Model status</dt>
            <dd className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 ring-1 ring-slate-200">
              Prototype
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
