"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AnalyticalMap } from "@/components/maps/analytical/analytical-map";
import { ACCESS_MODE, TYPE_HEX } from "@/lib/map/modes/access";
import {
  ACCESS_POINTS_URL,
  ACCESS_REFERENCE,
  FACILITY_TYPES,
  FACILITY_TYPE_LABEL,
  isPriced,
  totalMapped,
  type AccessFacilityType,
  type AccessPoints,
  type AccessUnit,
} from "@/lib/access/reference";
import { formatCount, formatIsoDate } from "@/lib/map/format";
import type { MapDataBundle, MapFilters, MapLayerToggles, MapViewMode, ModeFrame } from "@/lib/map/types";

const EMPTY_FRAME: ModeFrame = { features: [], links: [] };
const { meta, units, medicines } = ACCESS_REFERENCE;
/** The DPRI item without its medicine name, which the card already shows: "500 mg tablet". */
const itemLabel = (item: string) =>
  item.replace(/^(PARACETAMOL|ORAL REHYDRATION SALT \(ORS 75-REPLACEMENT\)|LACTATED RINGER'S SOLUTION \(RINGER'S LACTATE\)|0\.9% SODIUM CHLORIDE)\s*/i, "") || item;
const php = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AccessView() {
  const [type, setType] = useState<AccessFacilityType>("pharmacy");
  const [view, setView] = useState<MapViewMode>("2d");
  const [toggles, setToggles] = useState<MapLayerToggles>({ links: false, columns: false, areas: true });
  const [points, setPoints] = useState<{ data?: AccessPoints; error?: string }>({});
  const [selectedFacility, setSelectedFacility] = useState<string | undefined>();
  const [unitId, setUnitId] = useState<string | undefined>();
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(ACCESS_POINTS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<AccessPoints>;
      })
      .then((data) => setPoints({ data }))
      .catch((error: unknown) => setPoints({ error: error instanceof Error ? error.message : "unknown error" }));
  }, []);

  const bundle = useMemo(
    () => ({ accessPoints: points.data, accessPointsError: points.error }) as MapDataBundle,
    [points],
  );
  const filters = useMemo(() => ({ facilityType: type }) as MapFilters, [type]);
  const prepared = useMemo(() => ACCESS_MODE.prepare?.(bundle, filters) ?? null, [bundle, filters]);
  const frame = useMemo(() => prepared?.frameAt(0, toggles) ?? EMPTY_FRAME, [prepared, toggles]);

  // Selecting a facility opens the reporting unit it belongs to.
  function selectFacility(id: string | undefined) {
    setSelectedFacility(id);
    if (!id || !points.data) return;
    const point = points.data.points[Number(id.slice(1))];
    if (point) setUnitId(points.data.meta.units[point[3]]);
  }

  const ranked = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units
      .filter((u) => !q || u.name.toLowerCase().includes(q))
      .sort((a, b) => (b.mappedPer100SqKm?.[type] ?? -1) - (a.mappedPer100SqKm?.[type] ?? -1));
  }, [query, type]);
  const unit = unitId ? units.find((u) => u.id === unitId) : undefined;
  const crossCheck = meta.facilityCounts.assignmentCrossCheck;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ACCESS"
        subtitle="Where people can reach care and dengue medicines, and what those medicines cost the public sector."
      />

      <Card className="p-4">
        <p className="text-sm text-slate-700">
          Built from real, pinned sources. Facilities are what is mapped in OpenStreetMap; prices are what DOH
          hospitals paid. <strong className="font-semibold">Medicine stock and what people search for are not shown</strong>:
          no public source reports them.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-xs text-slate-600">
          {meta.sources.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline gap-x-2">
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                {s.title}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <span>
                {s.snapshot ? `snapshot ${formatIsoDate(s.snapshot)} · ` : ""}
                {s.edition ? `${s.edition} · ` : ""}
                {s.license.split(";")[0].split("(")[0].trim()}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <SegmentedControl
        ariaLabel="Facility type"
        phoneGrid
        value={type}
        onChange={setType}
        className="self-start"
        items={FACILITY_TYPES.map((t) => ({
          id: t,
          label: FACILITY_TYPE_LABEL[t],
          leading: <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TYPE_HEX[t] }} aria-hidden="true" />,
        }))}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0 self-start overflow-hidden p-0">
          <AnalyticalMap
            modes={[ACCESS_MODE]}
            mode={ACCESS_MODE}
            onModeChange={() => undefined}
            view={view}
            onViewChange={setView}
            toggles={toggles}
            onTogglesChange={setToggles}
            prepared={prepared}
            frame={frame}
            index={0}
            onIndexChange={() => undefined}
            playing={false}
            onPlayingChange={() => undefined}
            selectedId={selectedFacility}
            onSelect={selectFacility}
            hideModeTabs
          />
        </Card>

        {/* The side column runs as tall as the map card; its list scrolls inside it. */}
        <div className="relative min-w-0">
          <Card className="flex max-h-[34rem] flex-col overflow-hidden xl:absolute xl:inset-0 xl:max-h-none">
            {unit ? (
              <UnitDetail unit={unit} type={type} onClose={() => setUnitId(undefined)} />
            ) : (
              <>
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold text-ink">Reporting units</p>
                  <p className="text-xs text-slate-500">
                    {FACILITY_TYPE_LABEL[type]} mapped per 100 km². Select a unit or a point for detail.
                  </p>
                  <label className="relative mt-2 block">
                    <span className="sr-only">Find a reporting unit</span>
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find a province or city"
                      className="h-11 w-full rounded-[var(--radius-control)] border border-control bg-sheet pl-8 pr-2.5 text-sm text-ink placeholder:text-slate-400 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:h-9"
                    />
                  </label>
                </div>
                <ul className="min-h-0 flex-1 divide-y divide-rule overflow-y-auto">
                  {ranked.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => setUnitId(u.id)}
                        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-raised"
                      >
                        <span className="text-ink">{u.name}</span>
                        <span className="shrink-0 tabular-nums text-slate-600">
                          {u.mappedPer100SqKm ? u.mappedPer100SqKm[type].toLocaleString("en-PH") : "No area"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      </div>

      <section aria-labelledby="access-medicines" className="flex flex-col gap-3">
        <div>
          <h2 id="access-medicines" className="text-base font-semibold text-ink">
            Dengue medicines: what the public sector paid
          </h2>
          <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">
            Lowest, median and highest unit price paid by DOH hospitals in 2025 procurement (2026 interim Drug Price
            Reference Index). These are procurement prices, not pharmacy shelf prices, and they say nothing about stock.
          </p>
        </div>
        <Card className="overflow-hidden">
          {/* Phones: each item as a two-line row. */}
          <ul className="divide-y divide-border sm:hidden">
            {medicines.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <MedicineHeading medicine={m} />
                <ul className="mt-1 divide-y divide-rule">
                  {m.items.map((item) => (
                    <li key={item.item} className="py-2">
                      {isPriced(item) ? (
                        <>
                          <p className="text-sm text-slate-700">{itemLabel(item.item)}</p>
                          <p className="mt-0.5 text-[13px] tabular-nums text-slate-500">
                            Median <span className="font-medium text-ink">{php(item.medianPhp)}</span> ·{" "}
                            {php(item.lowestPhp)} – {php(item.highestPhp)} · {item.reportingFacilities} hospitals
                          </p>
                        </>
                      ) : (
                        <p className="text-[13px] text-slate-500">
                          {item.item}: {item.status}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <table className="hidden w-full text-left text-sm sm:table">
            <thead>
              <tr className="border-b border-border text-xs text-slate-500">
                <th scope="col" className="py-2.5 pl-4 pr-3 font-medium">Item</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Lowest</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Median</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Highest</th>
                <th scope="col" className="py-2.5 pl-3 pr-4 text-right font-medium">Hospitals</th>
              </tr>
            </thead>
            {medicines.map((m) => (
              <tbody key={m.id} className="border-b border-border last:border-b-0">
                <tr>
                  <th scope="rowgroup" colSpan={5} className="px-4 pb-1.5 pt-4 text-left font-normal">
                    <MedicineHeading medicine={m} />
                  </th>
                </tr>
                {m.items.map((item, i) =>
                  isPriced(item) ? (
                    <tr key={item.item} className={i > 0 ? "border-t border-rule" : undefined}>
                      <td className="py-2 pl-4 pr-3 text-slate-700">{itemLabel(item.item)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">{php(item.lowestPhp)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-ink">{php(item.medianPhp)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">{php(item.highestPhp)}</td>
                      <td className="py-2 pl-3 pr-4 text-right tabular-nums text-slate-600">{item.reportingFacilities}</td>
                    </tr>
                  ) : (
                    <tr key={item.item} className={i > 0 ? "border-t border-rule" : undefined}>
                      <td className="py-2 pl-4 pr-4 text-slate-500" colSpan={5}>
                        {item.item}: {item.status}
                      </td>
                    </tr>
                  ),
                )}
                <tr aria-hidden="true">
                  <td colSpan={5} className="h-2 p-0" />
                </tr>
              </tbody>
            ))}
          </table>
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-ink">Limits of this data</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
          {meta.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          {formatCount(meta.facilityCounts.kept)} of {formatCount(meta.facilityCounts.features)} mapped features kept (
          {formatCount(meta.facilityCounts.excludedType)} outside dengue care such as dentists and vets,{" "}
          {formatCount(meta.facilityCounts.duplicates)} duplicates). Units are assigned by COD-AB code; the reporting-unit
          boundaries agree for {Math.round((crossCheck.agreed / Math.max(1, crossCheck.checked)) * 1000) / 10}% of
          facilities. Built by <code>scripts/access/build-access.mjs</code>.{" "}
          <Link href="/analyze/policy" className="font-medium text-accent hover:underline">
            Ask the Copilot about an LGU →
          </Link>
        </p>
      </Card>
    </div>
  );
}

type Medicine = (typeof medicines)[number];

/** A medicine's name, its role and whether it is on the PNF list. */
function MedicineHeading({ medicine: m }: { medicine: Medicine }) {
  return (
    <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <span>
        <span className="text-sm font-semibold text-ink">{m.name}</span>
        <span className="text-[13px] text-slate-500"> · {m.role}</span>
      </span>
      <span className="text-xs text-slate-500">
        {m.onPnfEml ? `On the PNF essential medicines list${m.pnfPage ? ` (p. ${m.pnfPage})` : ""}` : "Not on the PNF list"}
      </span>
    </span>
  );
}

function UnitDetail({ unit, type, onClose }: { unit: AccessUnit; type: AccessFacilityType; onClose: () => void }) {
  const lastFull = unit.dengue?.filter((y) => y.usableWeeks > 0) ?? [];
  return (
    <div className="flex flex-col overflow-y-auto">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="text-xs font-medium text-slate-500">{unit.unitType.replace(/_/g, " ")}</p>
          <h3 className="text-base font-semibold text-ink">{unit.name}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close unit detail"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-slate-500 hover:bg-slate-100 hover:text-ink sm:-mr-1 sm:-mt-1 sm:h-8 sm:w-8"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-sm">
        {FACILITY_TYPES.map((t) => (
          <div key={t} className={t === type ? "font-semibold" : undefined}>
            <dt className="text-xs text-slate-500">{FACILITY_TYPE_LABEL[t]} mapped</dt>
            <dd className="tabular-nums text-ink">
              {formatCount(unit.mappedFacilities[t])}
              {unit.mappedPer100SqKm && (
                <span className="ml-1 text-xs font-normal text-slate-500">
                  ({unit.mappedPer100SqKm[t].toLocaleString("en-PH")} / 100 km²)
                </span>
              )}
            </dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-slate-500">Area</dt>
          <dd className="tabular-nums">{unit.areaSqKm ? `${unit.areaSqKm.toLocaleString("en-PH")} km²` : "Unknown"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Population</dt>
          <dd className="text-slate-500">Not available</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Medicine stock</dt>
          <dd className="text-slate-500">Unknown: no public source</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">All mapped facilities</dt>
          <dd className="tabular-nums">{formatCount(totalMapped(unit))}</dd>
        </div>
      </dl>
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">Reported dengue cases</p>
          <EvidenceBadge kind="formal" />
        </div>
        <table className="mt-2 w-full text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 text-left font-medium">Year</th>
              <th className="py-1 text-right font-medium">Cases</th>
              <th className="py-1 text-right font-medium">Usable weeks</th>
            </tr>
          </thead>
          <tbody>
            {lastFull.map((y) => (
              <tr key={y.year} className="border-t border-rule">
                <td className="py-1">{y.year}</td>
                <td className="py-1 text-right tabular-nums">{formatCount(y.reportedCases)}</td>
                <td className="py-1 text-right tabular-nums">
                  {y.usableWeeks} of {y.weeks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          DOH-EB counts via HDX, summed over usable weeks only; missing and suspect weeks are not counted as zero. Cases
          are from 2016–2020, facilities from 2026.
        </p>
      </div>
    </div>
  );
}
