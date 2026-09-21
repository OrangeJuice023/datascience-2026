import { PlaceholderCard } from "@/components/placeholder-card";

export default function LabPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Lab
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          TRACE — detect and organize public-health signals.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderCard
          title="Signal intake queue"
          description="Incoming source/signal listing placeholder."
          height="h-72"
        />
        <PlaceholderCard
          title="Source coverage"
          description="Data source status and coverage placeholder."
          height="h-72"
        />
      </div>
    </div>
  );
}
