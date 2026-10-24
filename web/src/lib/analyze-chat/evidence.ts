import type { SigmaData } from "@/lib/sigma/data";
import { epiWeek } from "@/lib/national-observations";
import type { NationalSummary } from "@/lib/national-observations";
import { ACCESS_REFERENCE, FACILITY_TYPES, FACILITY_TYPE_LABEL, isPriced, type AccessUnit } from "@/lib/access/reference";
import type { PolicyEvidenceRecord } from "@/lib/policy-evidence/types";

/**
 * The evidence SIGI's Analyze copilot is given for one reporting unit: Lab
 * (the unit's real weekly cases, EARS alarms and DOH-threshold weeks, and the
 * national series), ACCESS (mapped facilities and DOH medicine prices),
 * Policy (verified local and national records) and the methods. Each item has
 * a stable id; the model may only cite these ids, and the server returns the
 * cited items as the answer's sources. Nothing here is demo data.
 */
export type EvidenceKind = "lab" | "access" | "policy" | "method";
export type EvidenceJurisdiction = "reporting unit" | "local" | "national" | "method";

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  jurisdiction: EvidenceJurisdiction;
  /** The reporting unit the item is about; null for national and method items. */
  unitId: string | null;
  title: string;
  /** What the model reads: facts only, with their caveats. */
  text: string;
  source: { name: string; url: string | null };
  /** In-app page that shows the same evidence. */
  href: string | null;
}

export interface EvidencePack {
  unitId: string;
  unitName: string;
  /** A second unit the user asked to compare with, when there is one. */
  compare: { unitId: string; unitName: string } | null;
  items: EvidenceItem[];
}

/**
 * Whether a policy record is local to a reporting unit. Records are keyed
 * either by the unit id ("quezon-city") or by the app's short LGU id
 * ("pasig" for "pasig-city"); nothing else matches, so one city's records
 * can never be scoped to another.
 */
export function isLocalPolicyFor(locationId: string | null, unitId: string): boolean {
  return locationId !== null && (locationId === unitId || `${locationId}-city` === unitId);
}

const YEARS = [2016, 2017, 2018, 2019, 2020];
const HDX_URL = "https://data.humdata.org/dataset/philippine-dengue-cases-and-deaths";

/**
 * Year-by-year Lab facts for one unit: reported cases over usable weeks,
 * EARS alarm weeks, DOH alert/epidemic weeks, and whether EARS fired before
 * the unit first crossed a DOH threshold that year. Missing and suspect weeks
 * are counted as such, never as zero cases.
 */
export function labItemsForUnit(data: SigmaData, unitId: string): EvidenceItem[] {
  const unit = data.units.find((u) => u.id === unitId);
  if (!unit) return [];
  const { codes, weeks } = data.meta;
  const ok = codes.quality.indexOf("ok");
  const swap = codes.quality.indexOf("suspect swap");
  const alarm = new Set(codes.ears.flatMap((c, i) => (c !== "none" && c !== "not computed" ? [i] : [])));
  const alert = codes.doh.indexOf("alert");
  const epidemic = codes.doh.indexOf("epidemic");

  const items: EvidenceItem[] = [];
  for (const year of YEARS) {
    // Epi (MMWR) years, as Lab and the DOH thresholds use them.
    const idx = weeks.flatMap((w, i) => (epiWeek(w).year === year ? [i] : []));
    let cases = 0;
    const usable: number[] = [];
    const alarms: string[] = [];
    const alerts: string[] = [];
    const epidemics: string[] = [];
    let swapWeeks = 0;
    for (const i of idx) {
      if (unit.quality[i] === swap) swapWeeks++;
      if (unit.quality[i] !== ok || unit.value[i] === null) continue;
      usable.push(i);
      cases += unit.value[i]!;
      if (alarm.has(unit.ears[i])) alarms.push(weeks[i]);
      if (unit.doh[i] === epidemic) epidemics.push(weeks[i]);
      else if (unit.doh[i] === alert) alerts.push(weeks[i]);
    }
    const peak = usable.reduce((best, i) => (best === -1 || unit.value[i]! > unit.value[best]! ? i : best), -1);
    const firstCrossing = [...alerts, ...epidemics].sort()[0];
    const firstAlarm = alarms[0];
    let order = "DOH thresholds are only computed from 2019, so there is no comparison this year.";
    if (year >= 2019) {
      if (firstAlarm && firstCrossing) {
        const lead = Math.round((Date.parse(firstCrossing) - Date.parse(firstAlarm)) / (7 * 86_400_000));
        order =
          lead > 0
            ? `The first EARS alarm (week of ${firstAlarm}) came ${lead} week${lead === 1 ? "" : "s"} before the first DOH-threshold week (${firstCrossing}).`
            : lead === 0
              ? `The first EARS alarm and the first DOH-threshold week were the same week (${firstAlarm}).`
              : `The first DOH-threshold week (${firstCrossing}) came ${-lead} week${lead === -1 ? "" : "s"} before the first EARS alarm (${firstAlarm}).`;
      } else if (firstCrossing) order = `DOH threshold crossed (first week ${firstCrossing}) with no EARS alarm this year.`;
      else if (firstAlarm) order = `EARS alarmed (first week ${firstAlarm}) but no DOH threshold was crossed this year.`;
      else order = "No EARS alarm and no DOH-threshold week this year.";
    }
    const list = (xs: string[]) => (xs.length === 0 ? "none" : xs.length <= 8 ? xs.join(", ") : `${xs.slice(0, 8).join(", ")} and ${xs.length - 8} more`);
    items.push({
      id: `lab-${unitId}-${year}`,
      kind: "lab",
      jurisdiction: "reporting unit",
      unitId,
      title: `${unit.name}: dengue weeks in ${year}`,
      text:
        `${cases.toLocaleString("en-PH")} reported cases over ${usable.length} usable weeks of ${idx.length}` +
        (peak >= 0 ? `; highest week ${weeks[peak]} with ${unit.value[peak]} cases` : "") +
        `. EARS alarm weeks (${alarms.length}): ${list(alarms)}.` +
        (year >= 2019
          ? ` DOH alert weeks (${alerts.length}): ${list(alerts)}. DOH epidemic weeks (${epidemics.length}): ${list(epidemics)}.`
          : "") +
        ` ${order}` +
        (swapWeeks > 0 ? ` ${swapWeeks} suspected cases/deaths swap week${swapWeeks === 1 ? " is" : "s are"} treated as no data.` : "") +
        " Retrospective DOH-EB counts; an EARS alarm is a statistical signal, not an official declaration.",
      source: { name: "DOH-EB dengue counts via HDX (Cirrolytix), CC BY; SIGMA EARS and DOH-threshold pipeline", url: HDX_URL },
      href: "/explore",
    });
  }
  return items;
}

export function methodItems(data: SigmaData): EvidenceItem[] {
  const e = data.meta.ears;
  return [
    {
      id: "method-ears",
      kind: "method",
      jurisdiction: "method",
      unitId: null,
      title: "How SIGMA's EARS alarm works",
      text: `CDC EARS C1, C2 and C3 compare each week with the same place's recent weeks (${e.baselineWeeks}-week baseline, at least ${e.minBaseline} usable). A week alarms when C1 or C2 exceeds ${e.c1c2Threshold} or C3 exceeds ${e.c3Threshold}, with at least ${e.minCount} cases. It flags an unusually fast rise against the place's own recent level; it is not a forecast, a measure of risk or incidence, or an official declaration.`,
      source: { name: "SIGMA pipeline (ml/ears.py), on DOH-EB counts via HDX", url: HDX_URL },
      href: "/",
    },
    {
      id: "method-doh",
      kind: "method",
      jurisdiction: "method",
      unitId: null,
      title: "How SIGMA's DOH threshold is computed",
      text: `${data.meta.doh} SIGMA computes it from each unit's own series to compare with EARS; it is not the DOH's own published status for any week.`,
      source: { name: "DOH PIDSR Manual of Procedures (as cited by the SIGMA pipeline)", url: null },
      href: "/",
    },
    {
      id: "method-assumptions",
      kind: "method",
      jurisdiction: "method",
      unitId: null,
      title: "Assumptions behind the reporting-unit data",
      text: `${data.meta.assumptions.join(" ")} ${data.meta.weekNote.replace(/`/g, "")}`,
      source: { name: "SIGMA data documentation", url: null },
      href: "/",
    },
  ];
}

export function nationalItem(national: NationalSummary | null): EvidenceItem[] {
  if (!national?.weekly.first || !national.weekly.last) return [];
  const w = national.weekly;
  return [
    {
      id: "lab-national-opendengue",
      kind: "lab",
      jurisdiction: "national",
      unitId: null,
      title: "National weekly dengue series (OpenDengue v1.3)",
      text: `Philippines, national only: ${w.recorded} recorded weeks from ${w.first} to ${w.last}, ${w.expected - w.recorded} weeks missing (gaps, not zeros).${
        w.stats ? ` Highest week ${w.stats.max.periodStart} with ${w.stats.max.value.toLocaleString("en-PH")} cases.` : ""
      } It has no sub-national detail.`,
      source: { name: "OpenDengue v1.3 (Clarke et al.), CC BY 4.0", url: "https://opendengue.org/" },
      href: "/analyze/lab",
    },
  ];
}

export function accessUnitItems(unit: AccessUnit | undefined): EvidenceItem[] {
  const hot = ACCESS_REFERENCE.meta.sources.find((s) => s.id === "hotosm-phl-health-facilities");
  const items: EvidenceItem[] = [];
  if (unit) {
    items.push({
      id: `access-${unit.id}-facilities`,
      kind: "access",
      jurisdiction: "reporting unit",
      unitId: unit.id,
      title: `${unit.name}: health facilities and pharmacies mapped`,
      text:
        `Mapped in OpenStreetMap (snapshot ${hot?.snapshot ?? "unknown"}): ` +
        FACILITY_TYPES.map((t) => `${unit.mappedFacilities[t]} ${FACILITY_TYPE_LABEL[t].toLowerCase()}`).join(", ") +
        (unit.areaSqKm && unit.mappedPer100SqKm
          ? `, on ${unit.areaSqKm} km² (${unit.mappedPer100SqKm.pharmacy} pharmacies and ${unit.mappedPer100SqKm.hospital} hospitals per 100 km²).`
          : ".") +
        " Mapping completeness varies, so a low count can mean low mapping, not low access. Medicine stock, search demand and population are not available from any public source.",
      source: { name: "© OpenStreetMap contributors, ODbL (HOT export on HDX)", url: hot?.url ?? null },
      href: "/analyze/access",
    });
  }
  return items;
}

/** DOH hospital procurement prices for dengue medicines: national, the same for every unit. */
export function medicinePriceItem(): EvidenceItem {
  const dpri = ACCESS_REFERENCE.meta.sources.find((s) => s.id === "doh-dpri-dashboard");
  const priced = ACCESS_REFERENCE.medicines
    .map((m) => {
      const first = m.items.find(isPriced);
      return first
        ? `${m.name}: median ₱${first.medianPhp} (₱${first.lowestPhp}–₱${first.highestPhp}, ${first.reportingFacilities} hospitals) for ${first.item}; ${m.onPnfEml ? "on" : "not on"} the PNF essential medicines list`
        : null;
    })
    .filter(Boolean);
  return {
    id: "access-medicines-dpri",
    kind: "access",
    jurisdiction: "national",
    unitId: null,
    title: "Dengue medicine prices paid by DOH hospitals (2026 interim DPRI)",
    text: `${priced.join(". ")}. These are 2025 public-hospital procurement prices, not pharmacy shelf prices, and say nothing about stock.`,
    source: { name: dpri?.attribution ?? "DOH Drug Price Reference Index", url: dpri?.url ?? null },
    href: "/analyze/access",
  };
}

/** Back-compatible: one unit's facilities plus the national price item. */
export function accessItems(unit: AccessUnit | undefined): EvidenceItem[] {
  return [...accessUnitItems(unit), medicinePriceItem()];
}

/** Local policy records for one unit (see isLocalPolicyFor), each naming the place it applies to. */
export function localPolicyItems(records: PolicyEvidenceRecord[], unitId: string, unitName: string): EvidenceItem[] {
  return records.filter((r) => isLocalPolicyFor(r.locationId, unitId)).map((r) => policyItem(r, unitId, unitName));
}

/** National policy records: context for every unit, never a finding about one. */
export function nationalPolicyItems(records: PolicyEvidenceRecord[]): EvidenceItem[] {
  return records.filter((r) => r.locationId === null).map((r) => policyItem(r, null, null));
}

/** Back-compatible: this unit's local records and all national records. */
export function policyItems(records: PolicyEvidenceRecord[], unitId: string, unitName = unitId): EvidenceItem[] {
  return [...localPolicyItems(records, unitId, unitName), ...nationalPolicyItems(records)];
}

function policyItem(r: PolicyEvidenceRecord, unitId: string | null, unitName: string | null): EvidenceItem {
  return {
      id: r.evidenceId,
      kind: "policy" as const,
      jurisdiction: unitId === null ? ("national" as const) : ("local" as const),
      unitId,
      title: r.sourceTitle,
      text:
        (unitName ? `Local record for ${unitName} only. ` : "National record. ") +
        `[${r.verificationStatus}] ${r.claim}` +
        (r.publicationDate ? ` (${r.publicationDate})` : "") +
        (r.caveats.length ? ` Caveats: ${r.caveats.join("; ")}.` : "") +
        (r.unresolvedQuestions.length ? ` Unresolved: ${r.unresolvedQuestions.join("; ")}.` : ""),
      source: { name: r.issuingOrganization, url: r.sourceUrl },
      href: "/analyze/policy",
  };
}

export interface PackUnit {
  unitId: string;
  unitName: string;
  accessUnit: AccessUnit | undefined;
  /** False for a known place with no reporting unit of its own: it gets no unit-level evidence. */
  hasUnitData: boolean;
}

/**
 * The pack for one place, optionally with a second place to compare. Unit
 * evidence (Lab, facilities, local policy) is built separately for each
 * place with that place's id in every item id, so nothing about one place
 * can be read as being about the other. National and method items appear once.
 */
export function buildEvidencePack(input: {
  unitId: string;
  unitName: string;
  sigma: SigmaData | null;
  national: NationalSummary | null;
  accessUnit: AccessUnit | undefined;
  policyRecords: PolicyEvidenceRecord[];
  hasUnitData?: boolean;
  compare?: PackUnit | null;
}): EvidencePack {
  const primary: PackUnit = {
    unitId: input.unitId,
    unitName: input.unitName,
    accessUnit: input.accessUnit,
    hasUnitData: input.hasUnitData ?? true,
  };
  const places = input.compare && input.compare.unitId !== primary.unitId ? [primary, input.compare] : [primary];
  const unitEvidence = (u: PackUnit): EvidenceItem[] => [
    ...(u.hasUnitData && input.sigma ? labItemsForUnit(input.sigma, u.unitId) : []),
    ...(u.hasUnitData ? accessUnitItems(u.accessUnit) : []),
    ...localPolicyItems(input.policyRecords, u.unitId, u.unitName),
  ];
  return {
    unitId: primary.unitId,
    unitName: primary.unitName,
    compare: places[1] ? { unitId: places[1].unitId, unitName: places[1].unitName } : null,
    items: [
      ...places.flatMap(unitEvidence),
      ...nationalItem(input.national),
      medicinePriceItem(),
      ...nationalPolicyItems(input.policyRecords),
      ...(input.sigma ? methodItems(input.sigma) : []),
    ],
  };
}

/** Evidence-id shapes SIGMA issues for unit-level items and policy records. */
const EVIDENCE_ID_SHAPE = /(?<![\w-])((?:lab|access)-[a-z0-9]+(?:-[a-z0-9]+)*-(?:\d{4}|facilities)|pe-[a-z0-9]+(?:-[a-z0-9]+)*)(?![\w-])/g;

/**
 * Models often write hyphens as U+2010 (hyphen), U+2011 (non-breaking hyphen)
 * or U+2212 (minus), which turns `lab-abra-2016` into an id no one issued and
 * leaves a correct answer without sources. Every one of them is a hyphen, so
 * the reply is normalised before it is signed, cited or shown. En and em
 * dashes are punctuation and are left alone.
 */
export function normalizeHyphens(reply: string): string {
  return reply.replace(/[‐‑−]/g, "-");
}

/**
 * Evidence ids the reply names that were not in this pack: another place's
 * Lab or facility items, or policy records SIGI was not given. They are never
 * turned into citations; the response lists them so the UI can say that part
 * of the answer is unsupported.
 */
export function foreignEvidenceIds(reply: string, pack: EvidencePack): string[] {
  const given = new Set(pack.items.map((i) => i.id));
  const found = new Set<string>();
  for (const match of reply.matchAll(EVIDENCE_ID_SHAPE)) {
    if (!given.has(match[1])) found.add(match[1]);
  }
  return [...found];
}

/** The pack's items the reply cites by id, in order of first citation. */
export function citedItems(reply: string, pack: EvidencePack): EvidenceItem[] {
  const ids = [...pack.items].sort((a, b) => b.id.length - a.id.length);
  const hits: { at: number; item: EvidenceItem }[] = [];
  for (const item of ids) {
    const re = new RegExp(`(?<![\\w-])${item.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
    const m = re.exec(reply);
    if (m) hits.push({ at: m.index, item });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.item);
}
