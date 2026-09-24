"use client";

import { SelectFilter } from "@/components/ui/select-filter";
import { SliderControl } from "@/components/ui/slider-control";
import { Button } from "@/components/ui/button";
import { DEMO_DISEASES } from "@/data/demo-signals";
import { DEMO_LGUS } from "@/data/demo-lgus";
import type { SimulationInputs } from "@/types";

export function SimulationControls({
  scenario,
  onChange,
  onRun,
  onReset,
  isRunning,
}: {
  scenario: SimulationInputs;
  onChange: (next: Partial<SimulationInputs>) => void;
  onRun: () => void;
  onReset: () => void;
  isRunning: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <SelectFilter
        label="Disease/Event"
        value={scenario.disease}
        onChange={(v) => onChange({ disease: v })}
        options={DEMO_DISEASES.map((d) => ({ value: d, label: d }))}
      />
      <SelectFilter
        label="Starting location"
        value={scenario.startingLocation}
        onChange={(v) => onChange({ startingLocation: v })}
        options={DEMO_LGUS.map((l) => ({ value: l.id, label: l.name }))}
      />

      <SliderControl
        label="Simulation horizon"
        value={scenario.horizon}
        min={7}
        max={28}
        step={1}
        valueLabel={`${scenario.horizon} days`}
        onChange={(v) =>
          onChange({
            horizon: v,
            interventionTiming: Math.min(scenario.interventionTiming, v),
          })
        }
        helperText="How many days forward the demo scenario plays out."
      />

      <SliderControl
        label="Spatial coupling"
        value={scenario.spatialCoupling}
        min={0}
        max={1}
        step={0.05}
        valueLabel={scenario.spatialCoupling.toFixed(2)}
        onChange={(v) => onChange({ spatialCoupling: v })}
        helperText="How strongly nearby LGUs are assumed to influence each other."
      />

      <SliderControl
        label="Signal persistence"
        value={scenario.persistence}
        min={0}
        max={1}
        step={0.05}
        valueLabel={scenario.persistence.toFixed(2)}
        onChange={(v) => onChange({ persistence: v })}
        helperText="How much recent activity is assumed to carry forward day to day."
      />

      <SliderControl
        label="Intervention timing"
        value={scenario.interventionTiming}
        min={0}
        max={scenario.horizon}
        step={1}
        valueLabel={`Day ${scenario.interventionTiming}`}
        onChange={(v) => onChange({ interventionTiming: v })}
        helperText="The day an assumed response/intervention begins in the scenario."
      />

      <SliderControl
        label="Signal intensity"
        value={scenario.intensity}
        min={0}
        max={1}
        step={0.05}
        valueLabel={scenario.intensity.toFixed(2)}
        onChange={(v) => onChange({ intensity: v })}
        helperText="Assumed starting strength of the signal before the scenario runs."
      />

      <div className="flex gap-2 pt-1">
        <Button onClick={onRun} disabled={isRunning} className="flex-1">
          {isRunning ? "Running…" : "Run Scenario"}
        </Button>
        <Button variant="secondary" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
