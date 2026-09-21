export function PlaceholderCard({
  title,
  description,
  height = "h-64",
}: {
  title: string;
  description: string;
  height?: string;
}) {
  return (
    <div
      className={`flex ${height} flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center`}
    >
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">{description}</p>
    </div>
  );
}

export function StatCard({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-300">—</p>
      <p className="mt-1 text-[11px] text-slate-400">No data connected yet</p>
    </div>
  );
}
