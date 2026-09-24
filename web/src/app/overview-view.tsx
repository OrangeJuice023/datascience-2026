"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { MapPanel } from "@/components/maps/map-panel";
import { MapLegend } from "@/components/maps/map-legend";
import { SignalTable } from "@/components/dashboard/signal-table";
import { ProcessStrip } from "@/components/dashboard/process-strip";
import { DEMO_SIGNALS } from "@/data/demo-signals";
import { getLguById } from "@/data/demo-lgus";
import { signalsToMapMarkers } from "@/lib/map-markers";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import { SEVERITY_ORDER, SIGNAL_STATUS_CONFIG } from "@/lib/status";

const MARKERS = signalsToMapMarkers(DEMO_SIGNALS);

const RECENT_SIGNALS = [...DEMO_SIGNALS]
  .sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[b.status] - SEVERITY_ORDER[a.status];
    return bySeverity !== 0 ? bySeverity : b.date.localeCompare(a.date);
  })
  .slice(0, 8);

/** Computed on the server from real formal observations; null if unavailable. */
export interface FormalSummary {
  weeklyCount: number;
  first: string;
  last: string;
  missingWeeks: number;
  latest: { periodStart: string; periodEnd: string; value: number };
  source: string;
}

export function OverviewView({ formal }: { formal: FormalSummary | null }) {
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {formal ? (
          <>
            <StatCard
              label="Historical dengue observations"
              value={`${formatCount(formal.weeklyCount)} weeks`}
              hint={`${formatIsoDate(formal.first)} – ${formatIsoDate(formal.last)} · ${formal.missingWeeks} weeks missing`}
              badge={<EvidenceBadge kind="formal" />}
            />
            <StatCard
              label="Latest formal observation"
              value={`${formatCount(formal.latest.value)} cases`}
              hint={`Week of ${formatIsoDate(formal.latest.periodStart)} · national · ${formal.source}`}
              badge={<EvidenceBadge kind="formal" />}
            />
          </>
        ) : (
          <StatCard
            label="Formal observations"
            value="Unavailable"
            tone="muted"
            hint="The formal data source could not be read"
            badge={<EvidenceBadge kind="formal" />}
          />
        )}
        <StatCard
          label="Open-source signals"
          value="Demo only"
          tone="muted"
          hint={`${DEMO_SIGNALS.length} sample signals · no live feed connected`}
          badge={<EvidenceBadge kind="signal" />}
        />
        <StatCard
          label="Baseline / anomaly model"
          value="Not fitted"
          tone="muted"
          hint="No model output on formal data yet"
          badge={<EvidenceBadge kind="model" />}
        />
      </div>

      {formal && (
        <p className="-mt-2 text-xs text-slate-500">
          Formal data is historical and national-only; it does not describe current conditions or
          any single LGU.{" "}
          <Link href="/lab" className="font-medium text-accent hover:underline">
            Explore the record in Lab →
          </Link>
        </p>
      )}

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Current signal landscape</h2>
              <EvidenceBadge kind="signal" />
            </div>
            <p className="text-xs text-slate-500">
              Illustrative demo signals across selected Philippine localities. Not case counts.
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
              <span className="font-medium text-slate-700">{selectedLgu.name}:</span>{" "}
              {selectedSignal.disease} — {SIGNAL_STATUS_CONFIG[selectedSignal.status].label}
            </p>
          ) : (
            <p>Select a marker to see its most recent demo signal.</p>
          )}
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Recent signals</h2>
            <EvidenceBadge kind="signal" />
            <span className="text-xs text-slate-400">Demo data</span>
          </div>
          <Link href="/explore" className="text-xs font-medium text-accent hover:underline">
            View in Explore →
          </Link>
        </div>
        <SignalTable signals={RECENT_SIGNALS} />
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Why this matters</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          SIGMA combines observed health indicators and open-source signals to help analysts
          identify unusual patterns that may warrant verification.
        </p>
      </Card>
    </div>
  );
}
