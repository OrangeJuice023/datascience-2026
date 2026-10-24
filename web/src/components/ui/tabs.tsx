"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
}

export function Tabs({
  items,
  activeId,
  onChange,
}: {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className="scroll-row flex gap-1 border-b border-border"
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`panel-${item.id}`}
            onClick={() => onChange(item.id)}
            className={cn(
              "-mb-px min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors md:min-h-10",
              isActive
                ? "border-accent text-ink"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-ink",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  activeId,
  children,
}: {
  id: string;
  activeId: string;
  children: ReactNode;
}) {
  if (id !== activeId) return null;
  return (
    <div id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}
