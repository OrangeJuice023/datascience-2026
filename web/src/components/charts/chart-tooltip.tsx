interface ChartTooltipPayloadItem {
  dataKey?: string;
  name?: string;
  value?: number | string;
  color?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((entry) => !entry.dataKey?.startsWith("band"));
  if (!visible.length) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      {label && <p className="font-medium text-slate-700">{label}</p>}
      <div className="mt-1 space-y-0.5">
        {visible.map((entry) => (
          <p key={entry.dataKey ?? entry.name} style={{ color: entry.color }}>
            {entry.name}:{" "}
            <span className="font-medium text-slate-900">{entry.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
