import type {
  AnomalyResult,
  EnvironmentalObservation,
  HealthObservation,
  IsoDate,
  TemporalResolution,
  WeatherCoverage,
  WeatherSourceId,
} from "@/types/data";
import type { Signal, LGU, TrendPoint, NeighborSummary } from "@/types";

export interface SignalQuery {
  /** Disease display name, e.g. "Dengue". */
  disease?: string;
  locationId?: string;
}

export interface ObservationQuery {
  temporalResolution?: TemporalResolution;
}

export interface EnvironmentQuery {
  /** Omit to get every source; sources are separate rows, never merged. */
  sourceId?: WeatherSourceId;
  /** Inclusive bounds on periodStart. */
  from?: IsoDate;
  to?: IsoDate;
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
  getNeighborSummaries(geographyId: string, disease: string): Promise<NeighborSummary[]>;
  /**
   * Model outputs for a formal series. Empty until a baseline model has
   * actually been fitted and run; callers must show "not fitted", never a
   * placeholder score.
   */
  getAnomalyResults(diseaseId: string, geographyId: string): Promise<AnomalyResult[]>;
  /**
   * Weekly city weather (context covariates), one record per week × source.
   * geographyId is a COD-AB pcode; demo LGU ids return nothing.
   */
  getEnvironmentalObservations(
    geographyId: string,
    query?: EnvironmentQuery,
  ): Promise<EnvironmentalObservation[]>;
  /** Coverage period, quality counts and comparability per geography × source. */
  getWeatherCoverage(): Promise<WeatherCoverage[]>;
}
