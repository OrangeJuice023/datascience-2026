import { StatCard } from "@/components/ui/stat-card";
import { summarizeTrajectory } from "@/data/demo-simulations";
import type { SimulationResultPoint, SimulationInputs } from "@/types";

export function ScenarioSummary({
  scenario,
  result,
}: {
  scenario: SimulationInputs;
  result: SimulationResultPoint[];
}) {
  const summary = summarizeTrajectory(result);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-xs font-semibold text-amber-800">
          Demonstration model
        </p>
        <p className="text-[11px] text-amber-700">
          Not a validated epidemiological forecast.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Starting signal" value="Elevated" hint="Demo assumption" />
        <StatCard label="Simulation horizon" value={`${scenario.horizon} days`} />
        <StatCard
          label="Areas reached"
          value={String(summary.areasReached)}
          hint="Demo result"
        />
        <StatCard
          label="Maximum modeled intensity"
          value={`${summary.maxIntensity.toFixed(2)}x`}
          hint={`Demo result · day ${summary.peakDay}`}
        />
      </div>
    </div>
  );
}
