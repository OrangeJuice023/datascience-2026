import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A headline figure: grey label over a 24px tabular value, and one grey line
 * naming the period or the source. "muted" is for states that are not a
 * number (demo only, not fitted), so they never read as a measured value.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  badge,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "elevated" | "muted";
  /** e.g. an EvidenceBadge naming what kind of evidence the value is. */
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col p-4", className)}>
      <div className="flex flex-col-reverse items-start gap-1 sm:flex-row sm:justify-between sm:gap-2">
        <p className="text-[13px] leading-snug text-slate-500">{label}</p>
        {badge}
      </div>
      <p
        className={cn(
          "mt-1.5 tabular-nums",
          tone === "muted" ? "text-lg font-medium text-slate-500" : "text-2xl font-semibold tracking-[-0.01em]",
          tone === "elevated" && "text-rose-700",
          tone === "default" && "text-ink",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p>}
    </div>
  );
}

/**
 * A row of headline figures in one container split by 1px dividers, instead
 * of a card per figure. Two columns on phones, `columns` from `lg` up.
 */
export function StatStrip({
  children,
  columns = 4,
  className,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border [&>*]:bg-sheet",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
