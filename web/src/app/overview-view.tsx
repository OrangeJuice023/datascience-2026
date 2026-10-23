"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard, StatStrip } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { MapPanel } from "@/components/maps/map-panel";
import { MapLegend } from "@/components/maps/map-legend";
import { SignalTable } from "@/components/dashboard/signal-table";
import { ProcessStrip } from "@/components/dashboard/process-strip";
import { Sigi, sigiStateForData } from "@/components/mascot/sigi";
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
        title="Overview"
        subtitle="Trace signals across space and time. Investigate patterns. Explore scenarios. Support verification."
      />

      <section aria-label="Data status" className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-cream/70 px-3 py-2.5 sm:px-4">
          <Sigi state={sigiStateForData({ connected: formal !== null, hasResult: formal !== null })} size={56} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-semibold text-ink">What this page holds</p>
            <p className="text-[13px] leading-snug text-slate-600">
              {formal
                ? "The historical national record is loaded. The signals on this page are demo data, and the anomaly model is not fitted."
                : "The formal record could not be read. Nothing on this page describes current conditions."}
            </p>
          </div>
        </div>

        <StatStrip columns={4}>
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
              className="col-span-2"
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
        </StatStrip>

        {formal && (
          <p className="text-[13px] text-slate-500">
            Formal data is historical and national-only; it does not describe current conditions or
            any single LGU.{" "}
            <Link href="/lab" className="font-medium text-accent hover:underline">
              Explore the record in Lab →
            </Link>
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-ink">Demo signal landscape</h2>
                <EvidenceBadge kind="signal" />
              </div>
              <p className="mt-0.5 text-[13px] text-slate-500">
                Illustrative demo signals across selected Philippine localities. Not case counts.
              </p>
            </div>
            <MapLegend />
          </div>
          <MapPanel
            markers={MARKERS}
            selectedId={selectedId}
            onSelect={setSelectedId}
            heightClassName="h-80 sm:h-[420px]"
          />
          <div className="mt-3 min-h-[1.25rem] text-[13px] text-slate-500" aria-live="polite">
            {selectedLgu && selectedSignal ? (
              <p>
                <span className="font-medium text-slate-800">{selectedLgu.name}:</span>{" "}
                {selectedSignal.disease} — {SIGNAL_STATUS_CONFIG[selectedSignal.status].label}
              </p>
            ) : (
              <p>Select a marker to see its most recent demo signal.</p>
            )}
          </div>
        </Card>

        <section aria-labelledby="recent-signals" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 id="recent-signals" className="text-base font-semibold text-ink">Recent signals</h2>
              <EvidenceBadge kind="signal" />
            </div>
            <Link href="/lab" className="text-[13px] font-medium text-accent hover:underline">
              View in Lab →
            </Link>
          </div>
          <SignalTable signals={RECENT_SIGNALS} layout="list" />
        </section>
      </div>

      <section aria-labelledby="how-sigma-works" className="flex flex-col gap-3">
        <div>
          <h2 id="how-sigma-works" className="text-base font-semibold text-ink">Why this matters</h2>
          <p className="mt-0.5 max-w-3xl text-[13px] text-slate-500">
            SIGMA combines observed health indicators and open-source signals to help analysts
            identify unusual patterns that may warrant verification.
          </p>
        </div>
        <ProcessStrip />
      </section>
    </div>
  );
}
