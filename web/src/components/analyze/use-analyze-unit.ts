"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** The unit Analyze opens on when the URL names none. */
export const DEFAULT_ANALYZE_UNIT = "quezon-city";

/**
 * The reporting unit (and optional comparison unit) Analyze is looking at,
 * kept in the URL (?unit=&compare=) so the SIGI hero, the subtab links and
 * the Policy evidence all read the same place. Unknown ids fall back to the
 * default unit and no comparison.
 */
export function useAnalyzeUnit(unitIds: ReadonlySet<string>) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const requested = params.get("unit");
  const unitId = requested && unitIds.has(requested) ? requested : DEFAULT_ANALYZE_UNIT;
  const requestedCompare = params.get("compare");
  const compareId = requestedCompare && requestedCompare !== unitId && unitIds.has(requestedCompare) ? requestedCompare : "";

  function update(next: { unit?: string; compare?: string }) {
    const query = new URLSearchParams(params.toString());
    const unit = next.unit ?? unitId;
    const compare = next.compare ?? (unit === compareId ? "" : compareId);
    if (unit === DEFAULT_ANALYZE_UNIT) query.delete("unit");
    else query.set("unit", unit);
    if (compare && compare !== unit) query.set("compare", compare);
    else query.delete("compare");
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return {
    unitId,
    compareId,
    setUnit: (unit: string) => update({ unit, compare: unit === compareId ? "" : undefined }),
    setCompare: (compare: string) => update({ compare }),
  };
}
