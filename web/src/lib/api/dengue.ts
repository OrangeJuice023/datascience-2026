import type {
  DengueObservationsData,
  DengueSeriesMeta,
  DengueSignalsData,
  DengueSummaryData,
  ObservationRecord,
} from "@sigma/contracts";
import type { HealthObservation } from "@/types/data";
import type { Signal } from "@/types";
import { summarizeNational, type NationalSummary } from "@/lib/national-observations";

/**
 * Dengue service layer.
 *
 * Source-of-truth rules enforced here:
 * - The national OpenDengue series is an OBSERVATION series. It is never
 *   presented as the output of the local EARS pipeline, and the two are kept
 *   in separate responses with separate metadata.
 * - An anomaly result is only ever reported when a provider actually returns
 *   one. While no model is connected, the response says `not_connected`.
 * - Open-source signals are demo data and are labelled as such in a separate
 *   block so they can never be mistaken for case counts.
 */

export interface DengueSourceDescriptor {
  id: string;
  name: string;
  version: string;
  extract: string;
  filter: string;
  citation: string;
  license: string;
  upstreamUrl: string | null;
  /** Inclusive ISO date bounds of the whole series. */
  from: string;
  to: string;
  /** Number of recorded observations. */
  rows: number;
}

export const DENGUE_SERIES_LIMITATIONS = [
  "The series is not continuous: missing weeks are absent, never zero-filled or interpolated.",
  "Case definition is 'total' for every row in this extract.",
  "Weekly rows come from mixed upstream origins (record-id prefixes WHOWPRO and MOH).",
  "OpenDengue methods allow upstream gaps of up to 6 weeks to be imputed; the extract does not flag which weeks, if any, were.",
  "Annual totals are meaningful only for epi years in which every week was recorded.",
];

export const DENGUE_SERIES_INTERPRETATION =
  "Historical national (Philippines) reported dengue case counts. Observed surveillance records, not a model output, not a forecast and not a confirmed outbreak statement.";

export const EARS_ENGINE = {
  id: "ears-cdc",
  name: "CDC EARS C1/C2/C3",
  location: "ml/ears.py (Python), ml/clean_dengue.py, ml/qa/",
  method: "C1: 7-week baseline, C2: 7-week baseline with 2-week lag, C3: sum of max(0, C2-1) over three weeks. Thresholds 3.0 (C1/C2) and 2.0 (C3); minimum 5 of 7 usable baseline weeks; standard deviation floored at 1; minimum 5 cases to alarm.",
  dataWindow: "2016-10-01 to 2021-03-01 (261 weeks)",
  geographicScope: "National plus 126 provinces and cities",
} as const;

export const EARS_LIMITATIONS = [
  "The EARS pipeline is implemented in Python but is not connected to this API.",
  "It requires two raw source files that are not committed to the repository, so its outputs have not been independently reproduced in this environment.",
  "EARS is a screening method: it alarms at the start of every season and does not by itself distinguish a large epidemic from an ordinary season.",
  "The DOH-style alert and epidemic thresholds computed by the pipeline are SIGMA's own calculation over three prior years; they are not the official DOH algorithm, which uses three to five years and regional thresholds.",
  "Weeks flagged as possible non-reporting or one-week spikes are reporting artefacts, and all of them raise an alarm if they are not excluded.",
];

/** Maps the source catalog entry for OpenDengue into an API source record. */
export function dengueSource(descriptor: DengueSourceDescriptor) {
  return {
    id: "opendengue",
    name: descriptor.name,
    status: "connected" as const,
    evidence: "formal" as const,
    purpose: "Historical national dengue case counts; the baseline series for ANALYZE.",
    scope: "National only. Sub-national rows exist in other OpenDengue extracts and are not connected.",
    coverage: {
      from: descriptor.from,
      to: descriptor.to,
      geographicLevel: "national",
      resolution: "weekly",
    },
    provenance: `${descriptor.extract}; filter ${descriptor.filter}; ${descriptor.citation}; ${descriptor.license}`,
    accessMethod: "Bulk release extract, validated at build time and committed as a frontend fixture",
  };
}

function toObservationRecord(o: HealthObservation): ObservationRecord {
  return {
    id: o.id,
    diseaseId: o.diseaseId,
    geographyId: o.geographyId,
    geographicLevel: o.geographicLevel,
    periodStart: o.periodStart,
    periodEnd: o.periodEnd,
    temporalResolution: o.temporalResolution,
    metric: o.metric,
    caseDefinition: o.caseDefinition,
    value: o.value,
  };
}

export interface BuildObservationsInput {
  observations: HealthObservation[];
  descriptor: DengueSourceDescriptor;
  from?: string;
  to?: string;
  limit: number;
}

export function buildObservations(input: BuildObservationsInput): DengueObservationsData {
  const summary = summarizeNational(input.observations);
  const filtered = input.observations.filter(
    (o) =>
      (!input.from || o.periodStart >= input.from) && (!input.to || o.periodStart <= input.to),
  );

  const slice = filtered.slice(0, input.limit);

  const series: DengueSeriesMeta = {
    source: dengueSource(input.descriptor),
    coverage: {
      from: input.descriptor.from,
      to: input.descriptor.to,
      weeks: summary.weekly.expected,
      recordedWeeks: summary.weekly.recorded,
    },
    gaps: summary.weekly.gaps,
    geographicLevel: "national",
    geographicScope: "Philippines (national). Sub-national reporting is not connected to this series.",
    interpretation: DENGUE_SERIES_INTERPRETATION,
    limitations: DENGUE_SERIES_LIMITATIONS,
  };

  return {
    series,
    observations: slice.map(toObservationRecord),
    truncated: slice.length < filtered.length,
  };
}

export interface BuildSummaryInput {
  observations: HealthObservation[];
  descriptor: DengueSourceDescriptor;
  limit: number;
}

export function buildSummary(input: BuildSummaryInput): DengueSummaryData {
  const summary: NationalSummary = summarizeNational(input.observations);

  const series: DengueSeriesMeta = {
    source: dengueSource(input.descriptor),
    coverage: {
      from: input.descriptor.from,
      to: input.descriptor.to,
      weeks: summary.weekly.expected,
      recordedWeeks: summary.weekly.recorded,
    },
    gaps: summary.weekly.gaps,
    geographicLevel: "national",
    geographicScope: "Philippines (national). Sub-national reporting is not connected to this series.",
    interpretation: DENGUE_SERIES_INTERPRETATION,
    limitations: DENGUE_SERIES_LIMITATIONS,
  };

  return {
    series,
    weekly: {
      points: summary.weekly.series.slice(0, input.limit).map((p) => ({
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        value: p.value,
        epiYear: p.epiYear,
        epiWeek: p.epiWeek,
      })),
      recorded: summary.weekly.recorded,
      expected: summary.weekly.expected,
      first: summary.weekly.first,
      last: summary.weekly.last,
      stats: summary.weekly.stats,
      epiYears: summary.weekly.epiYears,
    },
    yearly: summary.yearly.map((p) => ({
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      value: p.value,
    })),
    monthly: summary.monthly.map((p) => ({
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      value: p.value,
    })),
    caseDefinitions: summary.caseDefinitions,
  };
}

export interface BuildSignalsInput {
  /** Real anomaly results. Empty until a model is fitted and connected. */
  anomalyResults: {
    id: string;
    geographyId: string;
    periodStart: string;
    periodEnd: string;
    method: string;
    value: number;
    threshold: number;
    alarm: boolean;
  }[];
  /** Open-source signal demo data, kept separate and clearly labelled. */
  demoSignals: Signal[];
  /** Whether the EARS engine is wired to a provider yet. */
  earsConnected: boolean;
}

export function buildSignals(input: BuildSignalsInput): DengueSignalsData {
  const connected = input.earsConnected && input.anomalyResults.length > 0;

  return {
    status: connected ? "live" : "not_connected",
    reason: connected
      ? "Anomaly results are available from a connected model."
      : "No anomaly model is connected to this API. The EARS pipeline exists in the Python data track (ml/ears.py) but its outputs are not served here, so no anomaly result is reported. This is not evidence that no outbreak is occurring.",
    engine: {
      id: EARS_ENGINE.id,
      name: EARS_ENGINE.name,
      location: EARS_ENGINE.location,
      status: connected ? "connected" : "not_connected",
      method: EARS_ENGINE.method,
      dataWindow: EARS_ENGINE.dataWindow,
      geographicScope: EARS_ENGINE.geographicScope,
    },
    signals: connected ? input.anomalyResults : [],
    openSourceSignals: {
      isSample: true,
      records: input.demoSignals.map((s) => ({
        id: s.id,
        disease: s.disease,
        locationId: s.locationId,
        locationName: s.locationName,
        date: s.date,
        signalLevel: s.signalLevel,
        sourceCount: s.sourceCount,
        confidence: s.confidence,
        changePercent: s.changePercent,
        status: s.status,
      })),
      note: "Open-source signal demo data. These are illustrative activity indicators derived from simulated sources, not case counts, and not evidence of an outbreak.",
    },
    limitations: EARS_LIMITATIONS,
  };
}
