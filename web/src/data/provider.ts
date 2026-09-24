import type { HealthObservation, TemporalResolution } from "@/types/data";
import type { Signal, LGU, TrendPoint, NeighborSummary } from "@/types";

export interface SignalQuery {
  /** Disease display name, e.g. "Dengue". */
  disease?: string;
  locationId?: string;
}

export interface ObservationQuery {
  temporalResolution?: TemporalResolution;
}

/**
 * Data access boundary. Implementations are called from Server Components so
 * source datasets stay out of client bundles; pages pass derived records down.
 */
export interface DataProvider {
  getDiseases(): Promise<{ id: string; name: string }[]>;
  getSignals(query?: SignalQuery): Promise<Signal[]>;
  getHealthObservations(
    diseaseId: string,
    geographyId?: string,
    query?: ObservationQuery,
  ): Promise<HealthObservation[]>;
  getLgus(): Promise<LGU[]>;
  getLguById(id: string): Promise<LGU | undefined>;
  getTrendSeries(geographyId: string): Promise<TrendPoint[] | undefined>;
  getNeighborSummaries(geographyId: string): Promise<NeighborSummary[]>;
}
