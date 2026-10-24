import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Data states, kept inside the block they describe. Empty keeps the block's
 * frame with one sentence; loading keeps the layout; an error says what failed
 * and offers a retry.
 */
export function EmptyState({
  title = "No matching signals for the current filters.",
  description,
  icon,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-[var(--radius-card)] border border-dashed border-control bg-sheet px-4 py-4 sm:items-center sm:py-8 sm:text-center">
      {icon && <span className="mb-1 text-slate-400">{icon}</span>}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="max-w-md text-[13px] text-slate-500">{description}</p>}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-sheet p-4"
    >
      <p className="text-[13px] text-slate-500">{label}…</p>
      <div className="h-3 w-2/3 rounded bg-slate-100 motion-safe:animate-pulse" aria-hidden="true" />
      <div className="h-3 w-1/2 rounded bg-slate-100 motion-safe:animate-pulse" aria-hidden="true" />
      <div className="h-24 w-full rounded-md bg-slate-50" aria-hidden="true" />
    </div>
  );
}

export function ErrorState({
  message = "Unable to load signal data. Try again.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-rose-200 bg-rose-50 px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-rose-800">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-sm font-medium text-rose-800 underline underline-offset-2 hover:text-rose-950"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
