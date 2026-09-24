import type { LegendClassification, LegendSpec } from "@/lib/map/types";
import { cn } from "@/lib/utils";

const CLASSIFICATION_LABEL: Record<LegendClassification, string> = {
  categorical: "Categories",
  threshold: "Threshold classes",
  linear: "Linear scale",
  quantile: "Quantile classes",
  zscore: "Z-score classes",
  none: "No spatial layer",
};

/**
 * Config-driven legend. Every encoding a mode uses (color classes or ramp,
 * symbol size, extrusion height, opacity) is declared in its LegendSpec, so
 * the legend can never drift from what the layers actually draw.
 */
export function AnalyticalLegend({
  spec,
  showHeight,
  className,
}: {
  spec: LegendSpec;
  /** Height only applies when 3D columns are on screen. */
  showHeight: boolean;
  className?: string;
}) {
  return (
    <div className={cn("text-xs text-slate-600", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-slate-800">{spec.title}</p>
        <p className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
          {CLASSIFICATION_LABEL[spec.classification]}
        </p>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{spec.metric}</p>

      {spec.classes && (
        <ul className="mt-2 space-y-1">
          {spec.classes.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                style={{ background: item.color, boxShadow: "0 0 0 1px rgb(15 23 42 / 0.12)" }}
                aria-hidden="true"
              />
              <span className="flex-1 text-slate-700">{item.label}</span>
              {item.range && <span className="tabular-nums text-slate-400">{item.range}</span>}
            </li>
          ))}
        </ul>
      )}

      {spec.ramp && (
        <div className="mt-2">
          <div
            className="h-2 rounded-full"
            style={{ background: `linear-gradient(to right, ${spec.ramp.colors.join(", ")})` }}
            aria-hidden="true"
          />
          <div className="mt-1 flex justify-between tabular-nums text-slate-400">
            <span>{spec.ramp.minLabel}</span>
            <span>{spec.ramp.maxLabel}</span>
          </div>
        </div>
      )}

      {(spec.size || (showHeight && spec.height) || spec.opacity) && (
        <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
          {spec.size && (
            <li className="flex items-center gap-2">
              <span className="flex items-end gap-0.5" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              </span>
              <span>
                {spec.size.label} ({spec.size.minLabel}–{spec.size.maxLabel})
              </span>
            </li>
          )}
          {showHeight && spec.height && (
            <li className="flex items-center gap-2">
              <span className="flex items-end gap-0.5" aria-hidden="true">
                <span className="h-1.5 w-1 rounded-sm bg-slate-400" />
                <span className="h-3 w-1 rounded-sm bg-slate-400" />
              </span>
              <span>{spec.height.label}</span>
            </li>
          )}
          {spec.opacity && <li>{spec.opacity.label}</li>}
        </ul>
      )}

      {spec.note && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-snug text-slate-400">
          {spec.note}
        </p>
      )}
    </div>
  );
}
