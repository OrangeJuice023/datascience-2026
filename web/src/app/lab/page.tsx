import { OPENDENGUE_META, dataProvider } from "@/data/opendengue-provider";
import { summarizeNational } from "@/lib/national-observations";
import { LabView, type NationalLoad } from "./lab-view";

async function loadNational(): Promise<NationalLoad> {
  try {
    const [observations, anomalies] = await Promise.all([
      dataProvider.getHealthObservations("dengue", "ph"),
      dataProvider.getAnomalyResults("dengue", "ph"),
    ]);
    return {
      status: "ok",
      national: summarizeNational(observations),
      meta: OPENDENGUE_META,
      anomalies,
    };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "The formal data source could not be read.",
    };
  }
}

export default async function LabPage() {
  return <LabView load={await loadNational()} />;
}
