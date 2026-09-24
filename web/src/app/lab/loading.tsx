import { PageHeader } from "@/components/layout/page-header";
import { DataStateNotice } from "@/components/ui/data-state-notice";

export default function LabLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Trace" title="SIGMA Lab" subtitle="Investigate the pattern behind the signal." />
      <DataStateNotice state="loading" title="Loading formal observations…" />
    </div>
  );
}
