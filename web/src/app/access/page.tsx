import { loadAccessMapBundle } from "@/lib/map/load-bundle";
import { accessAssessments } from "@/lib/access/assessments";
import { AccessView } from "./access-view";

export default async function AccessPage() {
  const bundle = await loadAccessMapBundle();
  return <AccessView bundle={bundle} assessments={accessAssessments(bundle.access)} />;
}
