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
      className="flex gap-1 overflow-x-auto border-b border-slate-200"
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
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800",
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
