"use client";

import { useEffect, useState } from "react";
import PIXELS from "@/data/landing/pixel-map.json";
import { formatIsoDate } from "@/lib/map/format";
import { usePrefersReducedMotion } from "@/components/mascot/sigi";

/**
 * The landing hero's background: the 8-bit Philippines being scanned.
 *
 * Each pixel is one of the 126 HDX reporting units (pixel-map.json). A scan
 * line steps down the map once per sweep; each sweep shows the next week of
 * 2019, and the units with a real EARS alarm that week flash as the line
 * passes their row. Nothing here is simulated: the alarms are the units'
 * actual retrospective EARS results.
 */
const SWEEP_MS = 2800;
const ALARM = "3";
const PEAK_WEEK = PIXELS.states
  .map((week) => [...week].filter((s) => s === ALARM).length)
  .reduce((best, n, i, all) => (n > all[best] ? i : best), 0);

export function HeroScan() {
  const reducedMotion = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);
  const week = reducedMotion ? PEAK_WEEK : tick % PIXELS.weeks.length;
  const states = PIXELS.states[week];
  const { cols, rows } = PIXELS.meta;

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => setTick((t) => t + 1), SWEEP_MS);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg
        viewBox={`0 0 ${cols} ${rows}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-y-[4%] left-1/2 h-[92%] w-auto -translate-x-1/2"
        shapeRendering="crispEdges"
        style={{ ["--scan-rows" as string]: `${rows}px`, ["--scan-ms" as string]: `${SWEEP_MS}ms` }}
      >
        {PIXELS.cells.map(([row, col, unit]) => {
          const alarm = states[unit] === ALARM;
          return (
            <rect
              key={`${row}-${col}`}
              x={col + 0.1}
              y={row + 0.1}
              width={0.8}
              height={0.8}
              className={alarm ? "entry-scan-alarm" : "entry-scan-cell"}
              style={alarm && !reducedMotion ? { animationDelay: `${(row / rows) * SWEEP_MS}ms` } : undefined}
            />
          );
        })}
        {!reducedMotion && <rect className="entry-scan-line" x={0} y={-1} width={cols} height={1} />}
      </svg>
      <p className="absolute bottom-4 right-5 text-xs text-[var(--entry-ink)]/60 sm:right-8">
        Background: real EARS alarms across 126 reporting units, week of {formatIsoDate(PIXELS.weeks[week])}
      </p>
    </div>
  );
}
