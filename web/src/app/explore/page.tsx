import { loadMapBundle } from "@/lib/map/load-bundle";
import { ExploreView } from "./explore-view";

export default async function ExplorePage() {
  const bundle = await loadMapBundle();
  const diseases = Array.from(new Set(bundle.signals.map((s) => s.disease))).sort();
  const provinces = Array.from(new Set(bundle.lgus.map((lgu) => lgu.province))).sort();

  return <ExploreView bundle={bundle} diseases={diseases} provinces={provinces} />;
}
