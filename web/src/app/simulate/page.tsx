import { PlaceholderCard } from "@/components/placeholder-card";

export default function SimulatePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Simulate
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          SIMULATE — explore simple spatial-temporal scenarios.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderCard
          title="Scenario parameters"
          description="Scenario configuration form placeholder."
          height="h-72"
        />
        <PlaceholderCard
          title="Scenario map"
          description="Spatial-temporal scenario output placeholder."
          height="h-72"
        />
      </div>
    </div>
  );
}
