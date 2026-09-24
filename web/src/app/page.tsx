import { OPENDENGUE_META, dataProvider } from "@/data/opendengue-provider";
import { summarizeNational } from "@/lib/national-observations";
import { OverviewView, type FormalSummary } from "./overview-view";

async function loadFormalSummary(): Promise<FormalSummary | null> {
  try {
    const observations = await dataProvider.getHealthObservations("dengue", "ph", {
      temporalResolution: "weekly",
    });
    const { weekly } = summarizeNational(observations);
    const latest = observations.at(-1);
    if (!latest || !weekly.first || !weekly.last) return null;
    return {
      weeklyCount: weekly.recorded,
      first: weekly.first,
      last: weekly.last,
      missingWeeks: weekly.expected - weekly.recorded,
      latest: { periodStart: latest.periodStart, periodEnd: latest.periodEnd, value: latest.value },
      source: `${OPENDENGUE_META.source} v${OPENDENGUE_META.version}`,
    };
  } catch {
    return null;
  }
}

export default async function OverviewPage() {
  return <OverviewView formal={await loadFormalSummary()} />;
}
