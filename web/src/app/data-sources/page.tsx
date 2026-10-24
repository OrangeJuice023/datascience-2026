import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EVIDENCE_CONFIG, EvidenceBadge } from "@/components/ui/evidence-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { SOURCE_CATALOG, type SourceCatalogEntry } from "@/data/source-catalog";
import { buildSources } from "@/lib/api/sources";
import { formatIsoDate } from "@/lib/map/format";
import { SOURCE_USAGE, groupCatalog, type SourceUsage } from "./sections";

export const metadata: Metadata = {
  title: "Data sources — SIGMA",
  description:
    "Every dataset SIGMA uses: what it is for, where it appears, its coverage and update behaviour, its licence and the credit line to show.",
};

/** Lets long file paths and hashes wrap at 390px instead of widening the page. */
const WRAP = "[overflow-wrap:anywhere]";

const STATUS_LABEL: Record<SourceCatalogEntry["status"], { label: string; tone: "info" | "warning" | "neutral" }> = {
  connected: { label: "Connected", tone: "info" },
  demo: { label: "Demo: synthetic stand-in", tone: "warning" },
  planned: { label: "Planned: not ingested", tone: "neutral" },
};

/** The geography sources sit outside the four evidence kinds; badged in the same style. */
function EvidenceTag({ evidence }: { evidence: SourceCatalogEntry["evidence"] }) {
  if (evidence !== "geography") return <EvidenceBadge kind={evidence} />;
  return (
    <span
      title="Places, codes and boundaries; not health data"
      className="inline-flex items-center gap-1.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-300"
    >
      <span className="h-1.5 w-1.5 rounded-full border border-slate-400" aria-hidden="true" />
      Geography
    </span>
  );
}

function SourceName({ entry, className }: { entry: SourceCatalogEntry; className: string }) {
  if (!entry.url) return <h3 className={className}>{entry.name}</h3>;
  return (
    <h3 className={className}>
      <a
        href={entry.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-start gap-1 hover:text-accent hover:underline"
      >
        <span>{entry.name}</span>
        <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">(opens the source&apos;s page in a new tab)</span>
      </a>
    </h3>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-xs font-medium text-slate-400 sm:pt-0.5">{label}</dt>
      <dd className={`-mt-2 text-sm text-slate-700 sm:mt-0 ${WRAP}`}>{children}</dd>
    </div>
  );
}

function UsedIn({ usage }: { usage: SourceUsage | undefined }) {
  if (!usage || (usage.uses.length === 0 && !usage.buildOnly)) {
    return <p className="text-xs text-slate-500">Where it is used: not recorded.</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {usage.uses.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Where it is used">
          {usage.uses.map((use) => (
            <li key={`${use.href}-${use.detail ?? ""}`}>
              <Link
                href={use.href}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-teal-800 ring-1 ring-teal-200 transition-colors hover:bg-teal-100"
              >
                <span className="font-medium">{use.label}</span>
                {use.detail && <span className="text-teal-700/80">· {use.detail}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {usage.buildOnly && <p className={`text-xs text-slate-500 ${WRAP}`}>{usage.buildOnly}</p>}
    </div>
  );
}

function SourceCard({ entry, scope }: { entry: SourceCatalogEntry; scope: string | undefined }) {
  const usage = SOURCE_USAGE[entry.sourceId];
  const status = STATUS_LABEL[entry.status];
  return (
    <Card id={`source-${entry.sourceId}`} className="flex min-w-0 scroll-mt-20 flex-col p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <EvidenceTag evidence={entry.evidence} />
        <StatusBadge label={status.label} tone={status.tone} />
        {usage?.refresh && (
          <StatusBadge
            label={usage.refresh === "live" ? "Live tiles" : "Fixed copy"}
          />
        )}
      </div>
      <SourceName entry={entry} className="mt-2.5 text-base font-semibold leading-snug text-slate-900" />
      <p className="mt-1 text-sm text-slate-600">{entry.purpose}</p>

      <div className="mt-3">
        <UsedIn usage={usage} />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Field label="Coverage">{entry.resolution}</Field>
        <Field label="Updates">{entry.updateBehavior}</Field>
        <Field label="How it is obtained">{entry.accessMethod}</Field>
        <Field label="Provenance">{entry.provenance}</Field>
        <Field label="Scope and limits">{scope ?? "Not recorded."}</Field>
        <Field label="Licence">{entry.licence ?? "Not verified"}</Field>
      </dl>

      <figure className="mt-4 rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
        <figcaption className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Credit line to show
        </figcaption>
        <p className={`mt-1 text-sm text-slate-800 ${WRAP}`}>{entry.attribution}</p>
      </figure>
    </Card>
  );
}

function NotConnectedRow({ entry, scope }: { entry: SourceCatalogEntry; scope: string | undefined }) {
  const usage = SOURCE_USAGE[entry.sourceId];
  const status = STATUS_LABEL[entry.status];
  return (
    <li id={`source-${entry.sourceId}`} className="flex min-w-0 scroll-mt-20 flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <EvidenceTag evidence={entry.evidence} />
        <StatusBadge label={status.label} tone={status.tone} />
      </div>
      <SourceName entry={entry} className="text-sm font-semibold text-slate-900" />
      <p className="text-sm text-slate-600">{entry.purpose}</p>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Field label="Why not yet">
          {entry.status === "demo"
            ? "Nothing is ingested. Anything SIGMA shows in this shape is a synthetic stand-in, labelled demo."
            : "Nothing is ingested yet."}{" "}
          {entry.updateBehavior}.
        </Field>
        <Field label="Would be obtained by">{entry.accessMethod}</Field>
        <Field label="Coverage">{entry.resolution}</Field>
        <Field label="Scope and limits">{scope ?? "Not recorded."}</Field>
        <Field label="Licence">{entry.licence ?? "Not verified yet"}</Field>
      </dl>
      {usage && usage.uses.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs text-slate-500">Where the stand-ins appear:</p>
          <UsedIn usage={usage} />
        </div>
      )}
    </li>
  );
}

function SectionHeading({ id, title, intro, count }: { id: string; title: string; intro: string; count: number }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="flex scroll-mt-20 items-baseline gap-2 text-lg font-semibold tracking-tight text-slate-900">
        {title}
        <span className="text-sm font-normal tabular-nums text-slate-400">{count}</span>
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">{intro}</p>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</dd>
      <dd className="text-[11px] leading-snug text-slate-500">{hint}</dd>
    </div>
  );
}

/**
 * GET /data-sources
 *
 * Every dataset in the source catalogue, grouped by what it is for. The page
 * renders `data/source-catalog.ts` (and the API's scope lines from
 * `lib/api/sources.ts`), the same catalogue GET /api/v1/sources serves, so
 * the page, the API and the copilot cannot disagree about a source's status.
 */
export default function DataSourcesPage() {
  const scopes = new Map(buildSources().map((s) => [s.id, s]));
  const { groups, ungrouped, notConnected } = groupCatalog(SOURCE_CATALOG);
  const connected = SOURCE_CATALOG.filter((s) => s.status === "connected");
  const live = connected.filter((s) => SOURCE_USAGE[s.sourceId]?.refresh === "live");
  const demo = notConnected.filter((s) => s.status === "demo").length;
  const planned = notConnected.filter((s) => s.status === "planned").length;
  const hdxEnd = scopes.get("hdx-doh-dengue")?.coverage.to;
  const nationalEnd = scopes.get("opendengue")?.coverage.to;

  const sections = [
    ...groups.filter((g) => g.entries.length > 0).map((g) => ({ id: g.group.id, title: g.group.title, count: g.entries.length })),
    ...(ungrouped.length > 0 ? [{ id: "other", title: "Other", count: ungrouped.length }] : []),
    ...(notConnected.length > 0 ? [{ id: "not-connected", title: "Not connected", count: notConnected.length }] : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader
          eyebrow="Reference"
          title="Data sources"
          subtitle="What SIGMA is built from, where each dataset appears, and how to credit it."
          actions={
            <Link
              href="/documentation"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              API documentation
            </Link>
          }
        />

        <Card className="p-4 sm:p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-3 text-sm text-slate-600">
              <h2 className="text-sm font-semibold text-slate-900">How SIGMA uses data</h2>
              <p>
                SIGMA works only from public datasets it can name. Every connected dataset except the basemap is a fixed
                copy: downloaded once and processed offline, and what the site needs is bundled with it. Nothing on
                the map changes until someone rebuilds it. Each source&apos;s provenance below says what was
                recorded about the exact file used, such as its URL and SHA-256 hash.
              </p>
              <p>
                So the data is historical. The reporting-unit dengue counts end on{" "}
                {hdxEnd ? formatIsoDate(hdxEnd) : "an unrecorded date"} and the national series on{" "}
                {nationalEnd ? formatIsoDate(nationalEnd) : "an unrecorded date"}. The facility map is one
                OpenStreetMap snapshot and the medicine prices come from one DPRI edition. Missing weeks and suspect
                rows stay as no data, never zero. Only the basemap tiles load live.
              </p>
              <p>
                Each source states its licence and the exact credit line to show next to anything built from it.
                Sources that are not connected are listed separately at the end.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2 self-start">
              <Fact label="Connected" value={connected.length} hint="real records flow through SIGMA" />
              <Fact label="Fixed copies" value={connected.length - live.length} hint="downloaded once, rebuilt by hand" />
              <Fact label="Live" value={live.length} hint={live.length === 1 ? "basemap tiles only" : "loaded as pages open"} />
              <Fact label="Not connected" value={notConnected.length} hint={`${demo} demo, ${planned} planned`} />
            </dl>
          </div>

          <ul className="mt-5 flex flex-col gap-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:gap-x-5">
            {(["formal", "context"] as const).map((kind) => (
              <li key={kind} className="flex items-center gap-2">
                <EvidenceBadge kind={kind} />
                {EVIDENCE_CONFIG[kind].description}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <EvidenceTag evidence="geography" />
              Places, codes and boundaries; not health data
            </li>
          </ul>
        </Card>
      </div>

      <nav aria-label="Sections on this page" className="-mt-4">
        <ul className="flex flex-wrap gap-1.5">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                {s.title}
                <span className="tabular-nums text-slate-400">{s.count}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {groups
        .filter((g) => g.entries.length > 0)
        .map(({ group, entries }) => (
          <section key={group.id} aria-labelledby={group.id}>
            <SectionHeading id={group.id} title={group.title} intro={group.intro} count={entries.length} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {entries.map((entry) => (
                <SourceCard key={entry.sourceId} entry={entry} scope={scopes.get(entry.sourceId)?.scope} />
              ))}
            </div>
          </section>
        ))}

      {ungrouped.length > 0 && (
        <section aria-labelledby="other">
          <SectionHeading
            id="other"
            title="Other"
            intro="Connected sources not yet placed in a section above."
            count={ungrouped.length}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {ungrouped.map((entry) => (
              <SourceCard key={entry.sourceId} entry={entry} scope={scopes.get(entry.sourceId)?.scope} />
            ))}
          </div>
        </section>
      )}

      {notConnected.length > 0 && (
        <section aria-labelledby="not-connected">
          <SectionHeading
            id="not-connected"
            title="Not connected"
            intro="Identified in research but not feeding any real number in SIGMA. A demo source has synthetic stand-ins, labelled demo wherever they appear; a planned source has nothing ingested."
            count={notConnected.length}
          />
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 sm:p-5">
            <ul className="divide-y divide-slate-200">
              {notConnected.map((entry) => (
                <NotConnectedRow key={entry.sourceId} entry={entry} scope={scopes.get(entry.sourceId)?.scope} />
              ))}
            </ul>
          </div>
        </section>
      )}

      <p className="text-xs text-slate-500">
        The same catalogue is served as JSON by <code className="font-mono text-[11px]">GET /api/v1/sources</code>; see
        the{" "}
        <Link href="/documentation#group-service" className="font-medium text-accent hover:underline">
          API documentation
        </Link>
        . Pinned download URLs and hashes are recorded in{" "}
        <code className="font-mono text-[11px]">scripts/geo/sources.json</code> and{" "}
        <code className="font-mono text-[11px]">scripts/access/sources.json</code>. SIGMA is a hackathon prototype;
        nothing here is a validated public-health claim.
      </p>
    </div>
  );
}
