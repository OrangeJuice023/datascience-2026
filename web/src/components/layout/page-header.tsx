import type { ReactNode } from "react";

/**
 * The title row of every page: a noun title (24px), one grey sentence about
 * the data or its scope, and the page's real actions on the right.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-500 sm:text-[15px]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
