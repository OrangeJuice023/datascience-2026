import { dataProvider } from "@/data/opendengue-provider";
import { summarizeNational } from "@/lib/national-observations";
import { LabView } from "./lab-view";

export default async function LabPage() {
  const observations = await dataProvider.getHealthObservations("dengue", "ph");
  return <LabView national={summarizeNational(observations)} />;
}
