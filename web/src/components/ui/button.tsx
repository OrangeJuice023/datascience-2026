import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VARIANT_CLASSES = {
  primary: "bg-ink text-white hover:bg-slate-800 active:bg-slate-950",
  secondary: "border border-control bg-sheet text-slate-800 hover:bg-slate-50 active:bg-slate-100",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-ink active:bg-slate-200",
} as const;

/** One filled (ink) button per screen at most; secondary is outlined, ghost is text. */
export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT_CLASSES;
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-3.5 py-1.5 text-sm font-medium transition-colors sm:min-h-9 disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
