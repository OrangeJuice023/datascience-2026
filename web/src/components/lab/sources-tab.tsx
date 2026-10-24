import { Card } from "@/components/ui/card";
import { EvidenceBadge } from "@/components/ui/evidence-badge";

/**
 * The two datasets behind SIGMA's dengue analysis. Details mirror what is
 * recorded with each file: web/src/data/opendengue-ph.json (meta) and
 * scripts/geo/sources.json (hdx-doh-epi-dengue).
 */
const SOURCES = [
  {
    id: "opendengue",
    name: "OpenDengue v1.3",
    role: "Lab · National trend",
    publisher: "OpenDengue project (Clarke J et al., Sci Data 2024;11:296)",
    coverage: "Philippines, national · weekly · Dec 30, 2012 – Nov 25, 2023",
    note: "Temporal extract (WPRO). 544 recorded weeks; 25 weeks have no record and are shown as gaps.",
    license: "CC BY 4.0",
    url: "https://opendengue.org",
  },
  {
    id: "hdx-doh-epi-dengue",
    name: "Philippine Dengue Cases and Deaths (HDX)",
    role: "Lab · Reporting units and Method; Explore · SIGMA map (EARS and DOH thresholds)",
    publisher: "Cirrolytix on HDX; data attributed to the DOH Epidemiology Bureau",
    coverage: "126 DOH reporting units · weekly · 2016 – 2021",
    note: "Suspected cases/deaths swap rows and missing weeks are treated as no data, never zero.",
    license: "CC BY",
    url: "https://data.humdata.org/dataset/philippine-dengue-cases-and-deaths",
  },
];

export function SourcesTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SOURCES.map((source) => (
          <Card key={source.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <EvidenceBadge kind="formal" />
              <span className="text-xs text-slate-500">{source.license}</span>
            </div>
            <p className="text-base font-semibold leading-snug text-ink">{source.name}</p>
            <p className="text-xs text-slate-500">Used in {source.role}</p>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-400">Publisher</dt>
              <dd className="text-slate-700">{source.publisher}</dd>
              <dt className="text-slate-400">Coverage</dt>
              <dd className="text-slate-700">{source.coverage}</dd>
            </dl>
            <p className="text-xs text-slate-500">{source.note}</p>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-auto pt-1 text-[13px] font-medium text-accent hover:underline"
            >
              {source.url.replace("https://", "")} ↗
            </a>
          </Card>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Both datasets are historical, processed offline and bundled with the site; neither is a live
        feed. Lab shows dengue only, from these two sources; it has no demo or illustrative data.
      </p>
    </div>
  );
}
