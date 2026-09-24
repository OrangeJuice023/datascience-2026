import type { DataProvider, SignalQuery } from "./provider";
import { DEMO_SIGNALS } from "./demo-signals";
import { DEMO_LGUS, getLguById } from "./demo-lgus";
import { getTrendSeries } from "./demo-trends";
import { DISEASES } from "./sample/reference";
import { getNeighborSummaries } from "@/lib/neighbors";
import type { AnomalyResult, HealthObservation } from "@/types/data";
import type { Signal, LGU, TrendPoint, NeighborSummary } from "@/types";

export function filterSignals(signals: Signal[], query?: SignalQuery): Signal[] {
  return signals.filter(
    (s) =>
      (!query?.disease || s.disease === query.disease) &&
      (!query?.locationId || s.locationId === query.locationId),
  );
}

/** DEMO provider: sample signals and trends only; no formal observations. */
export class DemoDataProvider implements DataProvider {
  async getDiseases(): Promise<{ id: string; name: string }[]> {
    return DISEASES.map(({ id, name }) => ({ id, name }));
  }

  async getSignals(query?: SignalQuery): Promise<Signal[]> {
    return filterSignals(DEMO_SIGNALS, query);
  }

  async getHealthObservations(): Promise<HealthObservation[]> {
    return [];
  }

  async getLgus(): Promise<LGU[]> {
    return DEMO_LGUS;
  }

  async getLguById(id: string): Promise<LGU | undefined> {
    return getLguById(id);
  }

  async getTrendSeries(geographyId: string): Promise<TrendPoint[] | undefined> {
    return getTrendSeries(geographyId);
  }

  async getNeighborSummaries(geographyId: string): Promise<NeighborSummary[]> {
    return getNeighborSummaries(geographyId);
  }

  async getAnomalyResults(): Promise<AnomalyResult[]> {
    return [];
  }
}

export const dataProvider: DataProvider = new DemoDataProvider();
