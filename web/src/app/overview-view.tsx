import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard, StatStrip } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
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

/** Explore, then Analyze's subtabs in the order AnalyzeTabs shows them. */
function nextSteps(accessReady: boolean) {
  const access = {
    href: "/analyze/access",
    title: "ACCESS",
    text: accessReady
      ? "Health facilities and pharmacies mapped per reporting unit, and what dengue medicines cost the public sector."
      : "Not yet available: it opens once it runs on real, traceable sources.",
  };
  const rest = [
    {
      href: "/analyze/policy",
      title: "Policy",
      text: "Ask SIGI about a place's dengue record, access to care and policy evidence, with every source cited.",
    },
    {
      href: "/analyze/lab",
      title: "Lab",
      text: "The national weekly series, and each reporting unit's EARS and DOH-threshold weeks with data quality.",
    },
  ];
  return [
    {
      href: "/explore",
      title: "Explore",
      text: "Map reported cases, EARS signals, DOH thresholds and city weather, week by week.",
    },
    ...(accessReady ? [access, ...rest] : [...rest, access]),
  ];
}

function SectionTitle({ id, title, action }: { id: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-base font-semibold text-ink">
        {title}
      </h2>
      {action}
    </div>
  );
}

/**
 * Overview: what SIGMA is, what data it really holds, how its two signals
 * work and where the data comes from. Every figure is counted from the data
 * on the server; the page describes historical analysis, never current
 * conditions.
 */
export function OverviewView({
  formal,
  sigma,
  accessReady,
}: {
  formal: FormalSummary | null;
  sigma: SigmaSummary | null;
  accessReady: boolean;
}) {
  const loaded = formal !== null || sigma !== null;
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <PageHeader
          title="SIGMA"
          subtitle="Retrospective dengue surveillance for Philippine LGUs: when did weekly reports rise unusually fast (EARS), and when did they pass the DOH thresholds?"
        />
        <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-raised p-4">
          {/* A result was read, or the source could not be: the same rule as sigiStateForData. */}
          <Sigi state={loaded ? "insight" : "unavailable"} size={64} className="shrink-0" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-semibold text-ink">What this page shows</p>
            <p className="text-sm leading-relaxed text-slate-600">
              {loaded
                ? "Historical records only. SIGMA looks back at 2016–2021 reporting-unit data and the 2012–2023 national series; it is not a real-time alert system and does not forecast."
                : "The data files could not be read, so nothing is summarised here."}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="overview-coverage">
        <SectionTitle id="overview-coverage" title="Coverage" />
        <StatStrip columns={sigma ? 4 : 2}>
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
        </StatStrip>
      </section>

      {sigma && (
        <section aria-labelledby="overview-signals">
          <SectionTitle id="overview-signals" title="How the two signals work" />
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border lg:grid-cols-2 [&>*]:bg-sheet">
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">EARS: an unusually fast rise</h3>
                <EvidenceBadge kind="model" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                CDC EARS C1, C2 and C3 compare each week with that place&apos;s own recent weeks (a{" "}
                {sigma.meta.ears.baselineWeeks}-week baseline, at least {sigma.meta.ears.minBaseline} usable). A week
                alarms when C1 or C2 exceeds {sigma.meta.ears.c1c2Threshold} or C3 exceeds{" "}
                {sigma.meta.ears.c3Threshold}, and only with at least {sigma.meta.ears.minCount} cases.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                An alarm is a retrospective statistical signal. It is not a forecast, a measure of local risk or
                incidence, or an official declaration.
              </p>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">DOH threshold: high for the season</h3>
                <EvidenceBadge kind="model" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{sigma.meta.doh}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                Computed here from the reporting-unit series to compare with EARS; it is not the DOH&apos;s own
                published status for any week.
              </p>
            </div>
          </div>
          <Card className="mt-4 p-5">
            <h3 className="text-sm font-semibold text-ink">Assumptions the results depend on</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
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
        </section>
      )}

      <section aria-labelledby="overview-sources">
        <SectionTitle
          id="overview-sources"
          title="Data sources"
          action={
            <span className="flex flex-wrap gap-x-4 text-[13px] font-medium">
              <Link href="/data-sources" className="text-accent hover:underline">
                Licences and credit lines →
              </Link>
              <Link href="/documentation" className="text-accent hover:underline">
                API documentation →
              </Link>
            </span>
          }
        />
        <Card className="overflow-hidden">
          <ul className="divide-y divide-rule">
            {CONNECTED_SOURCES.map((s) => (
              <li key={s.sourceId}>
                <Link
                  href={`/data-sources#source-${s.sourceId}`}
                  className="group flex flex-col gap-0.5 px-5 py-3 transition-colors hover:bg-raised sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <span className="text-sm font-medium text-ink group-hover:text-accent sm:w-80 sm:shrink-0">
                    {s.name}
                  </span>
                  <span className="text-[13px] leading-relaxed text-slate-600 sm:text-sm">
                    {s.purpose} <span className="text-slate-500">· {s.licence ?? "licence not verified"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <nav aria-labelledby="overview-next">
        <SectionTitle id="overview-next" title="Where to go next" />
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4 [&>*]:bg-sheet">
          {nextSteps(accessReady).map((step) => (
            <li key={step.href}>
              <Link href={step.href} className="group flex h-full flex-col gap-1 p-4 transition-colors hover:bg-raised">
                <span className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                  {step.title}
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-accent motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-[13px] leading-relaxed text-slate-600">{step.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
