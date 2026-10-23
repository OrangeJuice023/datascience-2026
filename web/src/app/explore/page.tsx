import { loadMapBundle } from "@/lib/map/load-bundle";
import { ExploreView } from "./explore-view";

export default async function ExplorePage() {
  const bundle = await loadMapBundle();

  return <ExploreView bundle={bundle} />;
}
