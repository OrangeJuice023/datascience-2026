"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { PRIMARY_NAV, SECONDARY_NAV } from "@/lib/nav";

function sectionName(pathname: string): string {
  const all = [...PRIMARY_NAV, ...SECONDARY_NAV];
  const match = all.find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)));
  return match?.label ?? "SIGMA";
}

/**
 * On the frame, with no rule under it. Desktop: the product line and the
 * prototype notice. Phone: menu, the current section and the notice.
 */
export function TopBar({
  onMenuClick,
  logoSrc,
}: {
  onMenuClick: () => void;
  logoSrc?: string | null;
}) {
  const pathname = usePathname();
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 bg-frame pl-1 pr-3 lg:h-12 lg:px-2 lg:pr-4">
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-frame-active lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="flex items-center gap-2 lg:hidden">
          <BrandMark size={22} src={logoSrc} />
          <span className="truncate text-sm font-semibold text-ink">{sectionName(pathname)}</span>
        </span>
        <p className="hidden truncate text-[13px] text-slate-500 lg:block">
          Spatial Intelligence &amp; Geographic Modeling for Action
        </p>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
        title="Formal dengue data is real (OpenDengue national; HDX DOH reporting units, 2016–2021). Signals, anomaly and simulation outputs are demo data."
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        Prototype<span className="hidden sm:inline"> · real and demo data</span>
      </span>
    </header>
  );
}
