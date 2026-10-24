import { OPENDENGUE_META, dataProvider } from "@/data/opendengue-provider";
import { summarizeNational } from "@/lib/national-observations";
import { summarizeSigmaLab } from "@/lib/sigma/lab";
import { readSigmaData } from "@/lib/sigma/summary";
import { LabView, type NationalLoad, type UnitsLoad } from "./lab-view";

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

/**
 * Only the small summaries of the SIGMA export (unit list, method, quality
 * counts) are sent with the page; the weekly series (~1.2 MB) are fetched by
 * the Reporting units tab when it opens.
 */
async function loadUnits(): Promise<UnitsLoad> {
  const data = await readSigmaData();
  if (!data) {
    return {
      status: "unavailable",
      message: "The SIGMA reporting-unit export (public/data/sigma/hdx-dengue-sigma.json) could not be read.",
    };
  }
  return { status: "ok", summary: summarizeSigmaLab(data) };
}

export default async function LabPage() {
  const [national, units] = await Promise.all([loadNational(), loadUnits()]);
  return <LabView load={national} units={units} />;
}
