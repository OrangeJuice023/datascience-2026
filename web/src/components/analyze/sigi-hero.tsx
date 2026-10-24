"use client";

import { useMemo } from "react";
import { PolicyCopilot } from "@/components/policy/policy-copilot";
import { SelectFilter } from "@/components/ui/select-filter";
import { copilotConversationKey } from "@/lib/policy-chat/copilot-ui";
import { useAnalyzeUnit } from "./use-analyze-unit";

const DISEASE = "Dengue";

/** What evidence SIGMA holds for one unit, so suggestions never promise more. */
export interface UnitEvidence {
  hasLab: boolean;
  hasAccess: boolean;
  hasLocalPolicy: boolean;
}

/**
 * SIGI at the top of Analyze, above the ACCESS / Policy / Lab tabs. It lives
 * in the Analyze layout, so a conversation survives switching subtabs; the
 * unit and comparison are read from and written to the URL (?unit=&compare=),
 * which the Policy evidence reads too. Changing either starts a new
 * conversation (the copilot is keyed by place, as before).
 */
export function SigiHero({
  units,
  evidence,
}: {
  units: { id: string; name: string }[];
  evidence: Record<string, UnitEvidence>;
}) {
  const ids = useMemo(() => new Set(units.map((u) => u.id)), [units]);
  const { unitId, compareId, setUnit, setCompare } = useAnalyzeUnit(ids);
  const unitName = units.find((u) => u.id === unitId)?.name ?? unitId;
  const compare = compareId ? units.find((u) => u.id === compareId) : undefined;
  const has = evidence[unitId] ?? { hasLab: false, hasAccess: false, hasLocalPolicy: false };

  return (
    <div className="mx-auto mb-6 w-full max-w-[820px]">
      <PolicyCopilot
        key={copilotConversationKey(DISEASE, compare ? `${unitId}+${compare.id}` : unitId)}
        variant="hero"
        disease={DISEASE}
        locationId={unitId}
        locationName={unitName}
        compareLocationId={compare?.id}
        compareName={compare?.name}
        suggestionContext={{ place: unitName, ...has }}
        intro={
          <>
            Answers about any of the {units.length} reporting units from Lab, ACCESS and policy evidence, with
            numbered sources. Dengue only. It does not declare outbreaks, know current case counts or medicine
            stock, or make decisions for you.
          </>
        }
        controls={
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectFilter
              label="Reporting unit"
              value={unitId}
              onChange={setUnit}
              options={units.map((u) => ({ value: u.id, label: u.name }))}
            />
            <SelectFilter
              label="Compare with (optional)"
              value={compareId}
              onChange={setCompare}
              options={[
                { value: "", label: "No comparison" },
                ...units.filter((u) => u.id !== unitId).map((u) => ({ value: u.id, label: u.name })),
              ]}
            />
          </div>
        }
      />
    </div>
  );
}
