import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { ProcessStrip } from "@/components/dashboard/process-strip";
import { Sigi } from "@/components/mascot/sigi";
import { SOURCE_CATALOG } from "@/data/source-catalog";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import type { SigmaSummary } from "@/lib/sigma/summary";

/** Computed on the server from real formal observations; null if unavailable. */
export interface FormalSummary {
  weeklyCount: number;
  first: string;
  last: string;
  missingWeeks: number;
  latest: { periodStart: string; periodEnd: string; value: number };
  source: string;
}

const CONNECTED_SOURCES = SOURCE_CATALOG.filter((s) => s.status === "connected");

/**
 * Overview: what SIGMA is, what data it really holds and how its two
 * signals work. Every figure is counted from the data on the server; the
 * page describes historical analysis, never current conditions.
 */
export function OverviewView({ formal, sigma }: { formal: FormalSummary | null; sigma: SigmaSummary | null }) {
  const loaded = formal !== null || sigma !== null;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Public health intelligence"
        title="SIGMA"
        subtitle="Retrospective dengue surveillance for Philippine LGUs: when did weekly reports rise unusually fast (EARS), and when did they pass the DOH thresholds?"
      />

      <ProcessStrip />

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/60 p-3 sm:p-4">
        {/* A result was read, or the source could not be: the same rule as sigiStateForData. */}
        <Sigi state={loaded ? "insight" : "unavailable"} size={72} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-900">What this page shows</p>
          <p className="text-sm text-slate-600">
            {loaded
              ? "Historical records only. SIGMA looks back at 2016–2021 reporting-unit data and the 2012–2023 national series; it is not a real-time alert system and does not forecast."
              : "The data files could not be read, so nothing is summarised here."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sigma ? (
          <>
            <StatCard
              label="Reporting units"
              value={formatCount(sigma.units)}
              hint={`Weekly, ${formatIsoDate(sigma.firstWeek)} – ${formatIsoDate(sigma.lastWeek)} · ${sigma.weeks} weeks · DOH-EB via HDX`}
              badge={<EvidenceBadge kind="formal" />}
            />
            <StatCard
              label="Unit-weeks with an EARS alarm"
              value={formatCount(sigma.earsAlarmUnitWeeks)}
              hint={`of ${formatCount(sigma.usableUnitWeeks)} usable unit-weeks · peak ${sigma.peak.units} units, week of ${formatIsoDate(sigma.peak.week)}`}
              badge={<EvidenceBadge kind="model" />}
            />
            <StatCard
              label="Unit-weeks above a DOH threshold"
              value={formatCount(sigma.dohCrossingUnitWeeks)}
              hint="Alert or epidemic threshold; thresholds start in 2019"
              badge={<EvidenceBadge kind="model" />}
            />
          </>
        ) : (
          <StatCard
            label="Reporting-unit results"
            value="Unavailable"
            tone="muted"
            hint="The SIGMA results file could not be read"
            badge={<EvidenceBadge kind="formal" />}
          />
        )}
        {formal ? (
          <StatCard
            label="National weekly series"
            value={`${formatCount(formal.weeklyCount)} weeks`}
            hint={`${formatIsoDate(formal.first)} – ${formatIsoDate(formal.last)} · ${formal.missingWeeks} weeks missing · ${formal.source}`}
            badge={<EvidenceBadge kind="formal" />}
          />
        ) : (
          <StatCard
            label="National weekly series"
            value="Unavailable"
            tone="muted"
            hint="The OpenDengue series could not be read"
            badge={<EvidenceBadge kind="formal" />}
          />
        )}
      </div>

      {sigma && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900">EARS: an unusually fast rise</h2>
            <p className="mt-2 text-sm text-slate-600">
              CDC EARS C1, C2 and C3 compare each week with that place&apos;s own recent weeks (a{" "}
              {sigma.meta.ears.baselineWeeks}-week baseline, at least {sigma.meta.ears.minBaseline} usable). A week
              alarms when C1 or C2 exceeds {sigma.meta.ears.c1c2Threshold} or C3 exceeds{" "}
              {sigma.meta.ears.c3Threshold}, and only with at least {sigma.meta.ears.minCount} cases.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              An alarm is a retrospective statistical signal. It is not a forecast, a measure of local risk or
              incidence, or an official declaration.
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900">DOH threshold: high for the season</h2>
            <p className="mt-2 text-sm text-slate-600">{sigma.meta.doh}</p>
            <p className="mt-2 text-xs text-slate-500">
              Computed here from the reporting-unit series to compare with EARS; it is not the DOH&apos;s own
              published status for any week.
            </p>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-900">Assumptions the results depend on</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {sigma.meta.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
              <li>{sigma.meta.weekNote.replace(/`/g, "")}</li>
              <li>
                {sigma.emptyWeeks} week{sigma.emptyWeeks === 1 ? "" : "s"} with no usable report for any unit
                {sigma.emptyWeeks === 1 ? " is" : " are"} shown as gaps, never as zero.
              </li>
            </ul>
          </Card>
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Data sources</h2>
          <Link href="/documentation" className="text-xs font-medium text-accent hover:underline">
            API and method documentation →
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-slate-100">
          {CONNECTED_SOURCES.map((s) => (
            <li key={s.sourceId} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="text-sm font-medium text-slate-800 sm:w-80 sm:shrink-0">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent hover:underline">
                    {s.name}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : (
                  s.name
                )}
              </span>
              <span className="text-sm text-slate-600">
                {s.purpose} <span className="text-slate-400">· {s.licence ?? "licence not verified"}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
