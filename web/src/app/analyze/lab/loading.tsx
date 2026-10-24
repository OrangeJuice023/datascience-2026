import { PageHeader } from "@/components/layout/page-header";
import { DataStateNotice } from "@/components/ui/data-state-notice";

export default function LabLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="SIGMA Lab" subtitle="Investigate the pattern behind the signal: dengue only, from real data only." />
      <DataStateNotice state="loading" title="Loading formal observations…" />
    </div>
  );
}
