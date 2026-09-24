import type { GeographicLevel, IsoDate, IsoDateTime, PublicHealthSignal, SignalSource } from "@/types/data";

/**
 * Contract for the future event-signal pipeline. Nothing here runs yet; no
 * scraping is implemented. It exists so ingestion lands behind a stable
 * interface, separate from formal observations:
 *
 *   News / RSS / GDELT → text extraction → disease extraction →
 *   location extraction → date/event extraction → deduplication →
 *   PSGC resolution → PublicHealthSignal → TRACE → spatiotemporal analysis
 *
 * The formal-data provider (OpenDengue) never produces signals, and signal
 * stages never emit HealthObservation records: a news report is not a case.
 */
export type SignalPipelineStage =
  | "fetch"
  | "text_extraction"
  | "disease_extraction"
  | "location_extraction"
  | "event_extraction"
  | "deduplication"
  | "geography_resolution"
  | "signal_assembly";

/** A fetched document before any interpretation. */
export interface RawDocument {
  sourceId: string;
  url: string;
  publisher: string | null;
  title: string;
  text: string | null;
  publishedAt: IsoDateTime;
  retrievedAt: IsoDateTime;
}

/** What the extraction stages recover from one document. */
export interface ExtractedEvent {
  document: RawDocument;
  diseaseId: string | null;
  locationText: string | null;
  eventDate: IsoDate | null;
  eventType: PublicHealthSignal["eventType"];
  /** Extractor name + version, recorded into provenance.pipeline. */
  extractor: string;
}

/** Result of resolving free-text location to a SIGMA geography (PSGC-reconciled). */
export interface GeographyResolution {
  geographyId: string | null;
  geographicLevel: GeographicLevel | null;
  psgcCode: string | null;
  method: "exact" | "alias" | "admin_match" | "point" | "unresolved";
}

/** Output of the pipeline: a signal and the documents that support it. */
export interface AssembledSignal {
  signal: PublicHealthSignal;
  sources: SignalSource[];
}
