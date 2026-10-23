import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  neutral: "bg-slate-100 text-slate-700",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  info: "bg-teal-50 text-teal-800",
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
        "inline-flex flex-none items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
