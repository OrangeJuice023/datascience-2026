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
      <label htmlFor={id} className="text-[11px] font-medium text-slate-500">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-md border border-slate-200 bg-white px-2.5 py-1.5 pr-8 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
