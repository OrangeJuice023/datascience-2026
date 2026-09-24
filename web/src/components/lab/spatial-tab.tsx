import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { MapPanel } from "@/components/maps/map-panel";
import { SignalBadge } from "@/components/ui/signal-badge";
import { getNeighborSummaries } from "@/lib/neighbors";
import { getLguById } from "@/data/demo-lgus";
import type { LGU, Signal } from "@/types";
import type { MapMarkerData } from "@/components/maps/types";

function concentrationLabel(elevatedCount: number, total: number): string {
  if (total === 0) return "Low";
  const ratio = elevatedCount / total;
  if (ratio >= 0.66) return "High";
  if (ratio >= 0.33) return "Medium";
  return "Low";
}

export function SpatialTab({ lgu, signal }: { lgu: LGU; signal: Signal }) {
  const neighbors = getNeighborSummaries(lgu.id, 3);
  const elevatedCount = neighbors.filter((n) => n.status === "elevated").length;
  const clusterSize = neighbors.length + 1;

  const markers: MapMarkerData[] = [
    {
      id: lgu.id,
      longitude: lgu.longitude,
      latitude: lgu.latitude,
      status: signal.status,
      label: lgu.name,
      sublabel: `${signal.disease} · selected`,
    },
    ...neighbors.flatMap((n): MapMarkerData[] => {
      const neighborLgu = getLguById(n.locationId);
      if (!neighborLgu) return [];
      return [
        {
          id: n.locationId,
          longitude: neighborLgu.longitude,
          latitude: neighborLgu.latitude,
          status: n.status,
          label: n.locationName,
        },
      ];
    }),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          label="Nearby elevated areas"
          value={String(elevatedCount)}
          hint="Demo value"
        />
        <StatCard
          label="Cluster size"
          value={`${clusterSize} LGUs`}
          hint="Demo value"
        />
        <StatCard
          label="Spatial concentration"
          value={concentrationLabel(elevatedCount, neighbors.length)}
          hint="Demo value"
        />
      </div>

      <Card className="p-4">
        <p className="mb-3 text-xs font-semibold text-slate-600">
          {lgu.name} and neighboring LGUs
        </p>
        <MapPanel
          markers={markers}
          selectedId={lgu.id}
          center={[lgu.longitude, lgu.latitude]}
          zoom={11}
          heightClassName="h-72"
        />
      </Card>

      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-600">Cluster summary</p>
        <ul className="mt-2 space-y-2">
          {neighbors.map((neighbor) => (
            <li
              key={neighbor.locationId}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-slate-600">{neighbor.locationName}</span>
              <SignalBadge status={neighbor.status} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
