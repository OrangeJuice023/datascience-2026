"use client";

export function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  valueLabel,
  helperText,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  valueLabel: string;
  helperText?: string;
}) {
  const id = `slider-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <span className="text-xs font-medium tabular-nums text-slate-500">
          {valueLabel}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-teal-600"
      />
      {helperText && <p className="text-xs text-slate-400">{helperText}</p>}
    </div>
  );
}
