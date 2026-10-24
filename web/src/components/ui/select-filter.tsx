"use client";

import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex min-w-[9rem] flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-500">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full cursor-pointer appearance-none rounded-[var(--radius-control)] border border-control bg-sheet pl-3 pr-8 text-sm text-ink hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:h-9"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
