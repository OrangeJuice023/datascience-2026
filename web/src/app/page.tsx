import { PlaceholderCard, StatCard } from "@/components/placeholder-card";

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Overview
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ACT — evidence and decision-support summary for public-health and
          LGU users.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active signals" />
        <StatCard label="Flagged anomalies" />
        <StatCard label="Regions monitored" />
        <StatCard label="Scenarios modeled" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PlaceholderCard
            title="Map view"
            description="MapLibre GL map placeholder — spatial overview will render here."
            height="h-80"
          />
        </div>
        <PlaceholderCard
          title="Recent activity"
          description="Signal and scenario activity feed placeholder."
          height="h-80"
        />
      </div>
    </div>
  );
}
