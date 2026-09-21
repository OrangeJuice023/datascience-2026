import { PlaceholderCard } from "@/components/placeholder-card";

export default function ExplorePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Explore
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ANALYZE — trends, anomalies, spatial clusters, and historical
          patterns.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderCard
          title="Spatial cluster map"
          description="MapLibre GL clustering placeholder."
          height="h-80"
        />
        <PlaceholderCard
          title="Trend chart"
          description="Recharts time-series placeholder."
          height="h-80"
        />
      </div>

      <PlaceholderCard
        title="Anomaly table"
        description="Detected anomaly listing placeholder."
        height="h-48"
      />
    </div>
  );
}
