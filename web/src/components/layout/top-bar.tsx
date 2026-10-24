"use client";

import { Menu } from "lucide-react";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <p className="hidden text-sm font-medium text-slate-500 sm:block">
          Spatial Intelligence &amp; Geographic Modeling for Action
        </p>
      </div>
      <span
        className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700"
        title="Real, historical data: DOH-EB dengue counts 2016-2021 (HDX), OpenDengue national 2012-2023, OpenStreetMap facilities, DOH medicine prices. Not a real-time alert system."
      >
        Prototype<span className="hidden sm:inline"> · historical data, not real-time</span>
      </span>
    </header>
  );
}
