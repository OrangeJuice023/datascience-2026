"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedItem<T extends string> {
  id: T;
  label: ReactNode;
  /** A mark before the label, e.g. an evidence dot or an icon. */
  leading?: ReactNode;
  /** A note after the label, e.g. "Planned". */
  trailing?: ReactNode;
  title?: string;
  /** Text read by screen readers after the label. */
  srLabel?: string;
}

/**
 * One choice from a few: a sand track with the selected option raised on the
 * sheet. As wide as its options; on phones it can fill the width as a
 * two-column grid (`phoneGrid`). Options are 44px tall on phones.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  size = "md",
  phoneGrid = false,
  className,
}: {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  size?: "md" | "sm";
  /** Two equal columns below `sm` instead of a wrapping row. */
  phoneGrid?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "gap-1 rounded-[10px] bg-slate-100 p-1",
        phoneGrid ? "grid grid-cols-2 sm:inline-flex sm:max-w-full sm:flex-wrap" : "inline-flex max-w-full flex-wrap",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={item.title}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-[7px] px-3 font-medium tabular-nums transition-colors sm:justify-start",
              size === "md" ? "text-sm sm:min-h-8" : "text-[13px] sm:min-h-7 sm:px-2.5",
              active ? "bg-sheet text-ink ring-1 ring-control" : "text-slate-600 hover:bg-sheet/60 hover:text-ink",
            )}
          >
            {item.leading}
            {item.label}
            {item.srLabel && <span className="sr-only">{item.srLabel}</span>}
            {item.trailing}
          </button>
        );
      })}
    </div>
  );
}
