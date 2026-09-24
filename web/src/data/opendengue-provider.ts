import "server-only";

import type { DataProvider, ObservationQuery, SignalQuery } from "./provider";
import { DemoDataProvider } from "./demo-provider";
import type {
  CaseDefinition,
  HealthObservation,
  TemporalResolution,
} from "@/types/data";
import opendengueData from "./opendengue.json";

interface OpenDengueRow {
  calendar_start_date: string;
  calendar_end_date: string;
  dengue_total: number;
  case_definition_standardised: string;
}

const UPSTREAM_URL =
  "https://raw.githubusercontent.com/OpenDengue/master-repo/main/data/releases/v1.3/opendengue_v1.3_national.csv";

/** Written once per server process; these records are real (isSample: false). */
const RECORDED_AT = new Date().toISOString();

/**
 * The PH national extract mixes yearly, monthly and weekly rows, and the
 * committed JSON dropped the upstream T_res column, so resolution is derived
 * from each row's period length rather than assumed.
 */
function inferResolution(start: string, end: string): TemporalResolution | null {
  const days =
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
  if (days === 7) return "weekly";
  if (days >= 28 && days <= 31) return "monthly";
  if (days === 365 || days === 366) return "yearly";
  return null;
}

function toCaseDefinition(value: string): CaseDefinition {
  switch (value.toLowerCase()) {
    case "total":
      return "total";
    case "confirmed":
      return "confirmed";
    case "probable":
      return "probable";
    case "suspected":
      return "suspected";
    default:
      return "unspecified";
  }
}

const OBSERVATIONS: HealthObservation[] = (opendengueData as OpenDengueRow[]).flatMap(
  (row): HealthObservation[] => {
    const resolution = inferResolution(row.calendar_start_date, row.calendar_end_date);
    if (!resolution) return [];
    return [
      {
        id: `opendengue-ph-${resolution}-${row.calendar_start_date}`,
        diseaseId: "dengue",
        geographyId: "ph",
        geographicLevel: "national",
        periodStart: row.calendar_start_date,
        periodEnd: row.calendar_end_date,
        temporalResolution: resolution,
        metric: "cases",
        caseDefinition: toCaseDefinition(row.case_definition_standardised),
        value: Number(row.dengue_total),
        provenance: {
          sourceIds: ["opendengue"],
          method: "ingested",
          upstreamUrl: UPSTREAM_URL,
          upstreamVersion: "1.3",
          recordedAt: RECORDED_AT,
          isSample: false,
        },
      },
    ];
  },
).sort((a, b) => a.periodStart.localeCompare(b.periodStart));

/**
 * Real formal observations (OpenDengue v1.3, national) alongside the demo
 * provider, which still serves signals, LGUs and trends. Server-only: the
 * source JSON must not be bundled for the browser.
 */
export class OpenDengueProvider implements DataProvider {
  private readonly demo = new DemoDataProvider();

  getDiseases() {
    return this.demo.getDiseases();
  }

  getSignals(query?: SignalQuery) {
    return this.demo.getSignals(query);
  }

  async getHealthObservations(
    diseaseId: string,
    geographyId?: string,
    query?: ObservationQuery,
  ): Promise<HealthObservation[]> {
    if (diseaseId !== "dengue" || (geographyId && geographyId !== "ph")) return [];
    return query?.temporalResolution
      ? OBSERVATIONS.filter((o) => o.temporalResolution === query.temporalResolution)
      : OBSERVATIONS;
  }

  getLgus() {
    return this.demo.getLgus();
  }

  getLguById(id: string) {
    return this.demo.getLguById(id);
  }

  /** Demo LGU series only; no baseline model has been run on the national series. */
  getTrendSeries(geographyId: string) {
    return this.demo.getTrendSeries(geographyId);
  }

  getNeighborSummaries(geographyId: string) {
    return this.demo.getNeighborSummaries(geographyId);
  }
}

export const dataProvider = new OpenDengueProvider();
