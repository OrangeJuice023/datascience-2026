import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "elevated" | "muted";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          tone === "elevated" && "text-rose-700",
          tone === "muted" && "text-slate-400",
          tone === "default" && "text-slate-900",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
