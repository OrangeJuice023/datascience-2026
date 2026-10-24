import { ACCESS_REFERENCE } from "@/lib/access/reference";
import { accessReadiness } from "@/lib/access/readiness";
import { readSigmaData } from "@/lib/sigma/summary";
import { unitYearSummaries } from "@/lib/sigma/unit-years";
import { PolicyView } from "./policy-view";

export default async function PolicyPage() {
  const sigma = await readSigmaData();
  const units = ACCESS_REFERENCE.units
    .map((u) => ({ id: u.id, name: u.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <PolicyView
      // ACCESS facts reach Policy only once ACCESS runs on real records.
      accessReady={accessReadiness(ACCESS_REFERENCE).ready}
      units={units}
      unitYears={sigma ? unitYearSummaries(sigma) : null}
    />
  );
}
