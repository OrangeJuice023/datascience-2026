"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { MapPanel } from "@/components/maps/map-panel";
import { MapLegend } from "@/components/maps/map-legend";
import { SignalTable } from "@/components/dashboard/signal-table";
import { ProcessStrip } from "@/components/dashboard/process-strip";
import { DEMO_SIGNALS, OVERVIEW_SUMMARY } from "@/data/demo-signals";
import { getLguById } from "@/data/demo-lgus";
import { signalsToMapMarkers } from "@/lib/map-markers";
import { SEVERITY_ORDER, SIGNAL_STATUS_CONFIG } from "@/lib/status";

const MARKERS = signalsToMapMarkers(DEMO_SIGNALS);

const RECENT_SIGNALS = [...DEMO_SIGNALS]
  .sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[b.status] - SEVERITY_ORDER[a.status];
    return bySeverity !== 0 ? bySeverity : b.date.localeCompare(a.date);
  })
  .slice(0, 8);

export default function OverviewPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selectedLgu = selectedId ? getLguById(selectedId) : undefined;
  const selectedSignal = selectedId
    ? [...DEMO_SIGNALS]
        .filter((s) => s.locationId === selectedId)
        .sort((a, b) => SEVERITY_ORDER[b.status] - SEVERITY_ORDER[a.status])[0]
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Public health intelligence"
        title="SIGMA"
        subtitle="Trace signals across space and time. Investigate patterns. Explore scenarios. Support verification."
      />

      <ProcessStrip />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active signals"
          value={String(OVERVIEW_SUMMARY.activeSignals)}
          hint="Demo data"
        />
        <StatCard
          label="Areas to review"
          value={String(OVERVIEW_SUMMARY.areasToReview)}
          hint="Demo data"
        />
        <StatCard
          label="Elevated signals"
          value={String(OVERVIEW_SUMMARY.elevatedSignals)}
          tone="elevated"
          hint="Demo data"
        />
        <StatCard
          label="Last updated"
          value="Demo environment"
          tone="muted"
          hint="No live feed connected"
        />
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Current signal landscape
            </h2>
            <p className="text-xs text-slate-500">
              Illustrative demo signals across selected Philippine localities
            </p>
          </div>
          <MapLegend />
        </div>
        <MapPanel
          markers={MARKERS}
          selectedId={selectedId}
          onSelect={setSelectedId}
          heightClassName="h-80 sm:h-96"
        />
        <div className="mt-3 min-h-[1.25rem] text-xs text-slate-500">
          {selectedLgu && selectedSignal ? (
            <p>
              <span className="font-medium text-slate-700">
                {selectedLgu.name}:
              </span>{" "}
              {selectedSignal.disease} —{" "}
              {SIGNAL_STATUS_CONFIG[selectedSignal.status].label}
            </p>
          ) : (
            <p>Select a marker to see its most recent demo signal.</p>
          )}
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Recent signals
          </h2>
          <Link
            href="/explore"
            className="text-xs font-medium text-accent hover:underline"
          >
            View in Explore →
          </Link>
        </div>
        <SignalTable signals={RECENT_SIGNALS} />
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Why this matters
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          SIGMA combines observed health indicators and open-source signals to
          help analysts identify unusual patterns that may warrant
          verification.
        </p>
      </Card>
    </div>
  );
}
