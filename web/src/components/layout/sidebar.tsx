"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** What each kind of evidence on the site currently is. Kept honest: nothing here is live. */
const DATA_STATUS = [
  { label: "Formal data", value: "OpenDengue · HDX DOH, static", dot: "bg-teal-600" },
  { label: "Signals", value: "Demo data", dot: "bg-amber-500" },
  { label: "Models", value: "Not fitted", dot: "bg-slate-300" },
] as const;

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors lg:h-9",
        active
          ? "bg-frame-active font-medium text-ink"
          : "text-slate-600 hover:bg-frame-active/60 hover:text-ink",
      )}
    >
      <Icon
        className={cn("h-4 w-4 shrink-0", active ? "text-ink" : "text-slate-500")}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      {item.label}
    </Link>
  );
}

export function SidebarContent({
  onNavigate,
  logoSrc,
}: {
  onNavigate?: () => void;
  logoSrc?: string | null;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-5 lg:h-12 lg:pt-2">
        <BrandMark size={28} src={logoSrc} />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-ink">SIGMA</p>
          <p className="text-xs text-slate-500">Philippines · public health</p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4 pt-5">
        <ul className="flex flex-col gap-0.5">
          {PRIMARY_NAV.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item.href)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>

        <p className="mt-7 px-3 text-xs text-slate-500">More</p>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {SECONDARY_NAV.map((item) => {
            if (item.disabled) {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <span
                    className="flex h-10 cursor-not-allowed items-center justify-between gap-2.5 rounded-lg px-3 text-sm text-slate-500 lg:h-9"
                    title="Not built yet"
                    aria-disabled="true"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      {item.label}
                    </span>
                    <span className="text-xs">Soon</span>
                  </span>
                </li>
              );
            }
            return (
              <li key={item.href}>
                <NavLink item={item} active={isActive(item.href)} onNavigate={onNavigate} />
              </li>
            );
          })}
        </ul>
      </nav>

      <dl className="mx-3 mb-4 space-y-2 rounded-xl bg-sheet/70 px-3 py-3 text-xs">
        {DATA_STATUS.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5">
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="flex items-start gap-1.5 font-medium text-slate-800">
              <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", row.dot)} aria-hidden="true" />
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
