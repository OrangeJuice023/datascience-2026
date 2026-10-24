import { PageHeader } from "@/components/layout/page-header";
import { DataStateNotice } from "@/components/ui/data-state-notice";
import { ACCESS_REFERENCE } from "@/lib/access/reference";
import { accessReadiness } from "@/lib/access/readiness";
import { AccessView } from "./access-view";

export default function AccessPage() {
  const readiness = accessReadiness(ACCESS_REFERENCE);

  // ACCESS is shown as a working feature only once it runs on real, pinned records.
  if (!readiness.ready) {
    return (
      <div className="flex max-w-3xl flex-col gap-5">
        <PageHeader
          eyebrow="Analyze"
          title="ACCESS"
          subtitle="Whether people in an area can reach care and dengue medicines."
        />
        <DataStateNotice state="source-unavailable" title="ACCESS is not available yet">
          <p>ACCESS will open here once it runs on real, traceable sources. It is not shown until then because:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {readiness.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="mt-2">No medicine stock or search figure is shown in its place.</p>
        </DataStateNotice>
      </div>
    );
  }

  return <AccessView />;
}
