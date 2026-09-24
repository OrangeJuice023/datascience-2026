import type { ReactNode } from "react";
import { Inbox, Loader2, AlertTriangle } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {icon ?? <Inbox className="h-6 w-6 text-slate-300" aria-hidden="true" />}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-slate-400">{description}</p>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center"
    >
      <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
      <p className="text-sm text-slate-500">{label}…</p>
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
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-6 py-12 text-center"
    >
      <AlertTriangle className="h-5 w-5 text-rose-500" aria-hidden="true" />
      <p className="text-sm font-medium text-rose-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 text-xs font-medium text-rose-700 underline underline-offset-2"
        >
          Retry
        </button>
      )}
    </div>
  );
}
