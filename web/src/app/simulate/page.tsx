"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SimulationControls } from "@/components/simulation/simulation-controls";
import { SimulationTimeline } from "@/components/simulation/simulation-timeline";
import { ScenarioSummary } from "@/components/simulation/scenario-summary";
import { AssumptionsSection } from "@/components/simulation/assumptions";
import { MapPanel } from "@/components/maps/map-panel";
import {
  DEFAULT_SCENARIO,
  generateDemoTrajectory,
} from "@/data/demo-simulations";
import { getLguById, getNeighborLgus } from "@/data/demo-lgus";
import type { MapMarkerData } from "@/components/maps/types";
import type { SimulationInputs } from "@/types";

export default function SimulatePage() {
  const [scenario, setScenario] = useState<SimulationInputs>(DEFAULT_SCENARIO);
  const [dayCursor, setDayCursor] = useState(DEFAULT_SCENARIO.horizon);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fullTrajectory = generateDemoTrajectory(scenario);
  const visibleTrajectory = fullTrajectory.slice(0, dayCursor + 1);

  function clearRun() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }

  function updateScenario(patch: Partial<SimulationInputs>) {
    clearRun();
    setScenario((prev) => ({ ...prev, ...patch }));
    setDayCursor(0);
  }

  function runScenario() {
    clearRun();
    setDayCursor(0);
    setIsRunning(true);
    let day = 0;
    intervalRef.current = setInterval(() => {
      day += 1;
      setDayCursor(day);
      if (day >= scenario.horizon) clearRun();
    }, 90);
  }

  function resetScenario() {
    clearRun();
    setScenario(DEFAULT_SCENARIO);
    setDayCursor(DEFAULT_SCENARIO.horizon);
  }

  useEffect(() => clearRun, []);

  const startLgu = getLguById(scenario.startingLocation);
  const currentAreasReached =
    visibleTrajectory[visibleTrajectory.length - 1]?.areasReached ?? 0;
  const neighbors = startLgu ? getNeighborLgus(startLgu.id, 8) : [];
  const reachedNeighbors = neighbors.slice(0, Math.max(0, currentAreasReached - 1));

  const markers: MapMarkerData[] = startLgu
    ? [
        {
          id: startLgu.id,
          longitude: startLgu.longitude,
          latitude: startLgu.latitude,
          status: "elevated",
          label: startLgu.name,
          sublabel: "Starting location",
        },
        ...reachedNeighbors.map((n) => ({
          id: n.id,
          longitude: n.longitude,
          latitude: n.latitude,
          status: "watch" as const,
          label: n.name,
          sublabel: "Modeled reach (demo)",
        })),
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Simulate"
        title="Scenario Simulation"
        subtitle="Explore how a public-health signal could evolve under different assumptions. This is scenario analysis, not outbreak prediction."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="p-4">
          <SimulationControls
            scenario={scenario}
            onChange={updateScenario}
            onRun={runScenario}
            onReset={resetScenario}
            isRunning={isRunning}
          />
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold text-slate-600">
              Modeled reach{startLgu ? ` from ${startLgu.name}` : ""}
            </p>
            {startLgu && (
              <MapPanel
                markers={markers}
                selectedId={startLgu.id}
                center={[startLgu.longitude, startLgu.latitude]}
                zoom={10}
                heightClassName="h-72"
              />
            )}
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-xs font-semibold text-slate-600">
              Modeled intensity over time
            </p>
            <SimulationTimeline
              data={visibleTrajectory}
              interventionDay={scenario.interventionTiming}
            />
          </Card>

          <ScenarioSummary scenario={scenario} result={fullTrajectory} />

          <AssumptionsSection />
        </div>
      </div>
    </div>
  );
}
