import { loadAccessBundle } from "@/lib/access/load";
import { accessAssessments } from "@/lib/access/assessments";
import { PolicyView } from "./policy-view";

export default async function PolicyPage() {
  const access = await loadAccessBundle();
  return <PolicyView accessAssessments={accessAssessments(access)} />;
}
