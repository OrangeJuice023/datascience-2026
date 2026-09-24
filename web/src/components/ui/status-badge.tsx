import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  info: "bg-teal-50 text-teal-700 ring-teal-200",
} as const;

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: keyof typeof TONE_CLASSES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
