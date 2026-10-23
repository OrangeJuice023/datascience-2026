"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import PIXELS from "@/data/landing/pixel-map.json";
import { SIGMA_HEX } from "@/lib/map/palette";
import { formatIsoDate } from "@/lib/map/format";
import { usePrefersReducedMotion } from "@/components/mascot/sigi";

/**
 * 2019, one week at a time: every pixel belongs to one of the 126 HDX
 * reporting units (web/scripts/build-landing-pixels.mjs) and takes that
 * unit's EARS result for the selected week. The colours are the SIGMA map's,
 * so the landing page and Explore agree.
 */
const STATE_COLOR = [SIGMA_HEX.noData, SIGMA_HEX.notEvaluated, SIGMA_HEX.quiet, SIGMA_HEX.alarm];
const STATE_LABEL = PIXELS.meta.states;
const ALARM = 3;
const STEP_MS = 420;

const ALARMS_PER_WEEK = PIXELS.states.map((week) => [...week].filter((s) => Number(s) === ALARM).length);
const PEAK_WEEK = ALARMS_PER_WEEK.indexOf(Math.max(...ALARMS_PER_WEEK));

const LAST_WEEK = PIXELS.weeks.length - 1;

export function PixelMap() {
  // null until the reader (or the autoplay) moves it.
  const [chosenWeek, setChosenWeek] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const figureRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  // A reader who asked for less motion starts on the peak week and plays it
  // by hand; everyone else starts in January.
  const week = chosenWeek ?? (reducedMotion ? PEAK_WEEK : 0);
  const running = playing && week < LAST_WEEK;

  // Starts once, when the map first scrolls into view.
  useEffect(() => {
    if (reducedMotion) return;
    const el = figureRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !startedRef.current) {
        startedRef.current = true;
        setPlaying(true);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setChosenWeek((w) => Math.min((w ?? 0) + 1, LAST_WEEK)), STEP_MS);
    return () => clearInterval(timer);
  }, [running]);

  const states = PIXELS.states[week];
  const alarms = ALARMS_PER_WEEK[week];
  const pickedState = picked === null ? null : Number(states[picked]);

  const cells = useMemo(
    () => PIXELS.cells.map(([row, col, unit]) => ({ row, col, unit, key: `${row}-${col}` })),
    [],
  );

  function togglePlay() {
    if (running) {
      setPlaying(false);
      return;
    }
    if (week >= LAST_WEEK) setChosenWeek(0);
    setPlaying(true);
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-center">
      <div ref={figureRef} className="mx-auto w-full max-w-md">
        <svg
          viewBox={`0 0 ${PIXELS.meta.cols} ${PIXELS.meta.rows}`}
          role="img"
          aria-label={`Map of the 126 dengue reporting units, week of ${formatIsoDate(PIXELS.weeks[week])}: ${alarms} with an EARS alarm.`}
          className="mx-auto h-auto max-h-[75vh] w-full"
          shapeRendering="crispEdges"
        >
          {cells.map(({ row, col, unit, key }) => (
            <rect
              key={key}
              x={col + 0.08}
              y={row + 0.08}
              width={0.84}
              height={0.84}
              fill={STATE_COLOR[Number(states[unit])]}
              stroke={picked === unit ? "#16302a" : "none"}
              strokeWidth={0.18}
              onPointerEnter={() => setPicked(unit)}
              onClick={() => setPicked(unit)}
            />
          ))}
        </svg>
      </div>

      <div className="flex flex-col gap-5">
        <p className="text-base text-[var(--entry-ink)]">
          <span className="font-pixel block text-5xl leading-none tabular-nums text-[var(--entry-green-deep)] sm:text-6xl">
            {alarms}
            <span className="text-2xl text-[var(--entry-ink)]/60"> / 126</span>
          </span>
          <span className="mt-2 block">
            reporting units with an EARS alarm in the week of{" "}
            <strong className="font-semibold">{formatIsoDate(PIXELS.weeks[week])}</strong>
          </span>
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="entry-key flex h-11 w-11 shrink-0 items-center justify-center rounded-none bg-[var(--entry-green)] text-white"
            aria-label={running ? "Pause the 2019 playback" : "Play 2019 week by week"}
          >
            {running ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
          </button>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="sr-only">Week of 2019</span>
            <input
              type="range"
              min={0}
              max={PIXELS.weeks.length - 1}
              value={week}
              onChange={(e) => {
                setPlaying(false);
                setChosenWeek(Number(e.target.value));
              }}
              className="w-full accent-[var(--entry-green)]"
            />
          </label>
        </div>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {[3, 2, 1, 0].map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 shrink-0" style={{ background: STATE_COLOR[s] }} aria-hidden="true" />
              {s === ALARM ? "EARS alarm" : s === 2 ? "No alarm" : s === 1 ? "Not computed" : "No data"}
            </li>
          ))}
        </ul>

        <p className="min-h-[3rem] text-sm text-[var(--entry-ink)]" aria-live="polite">
          {picked === null ? (
            "Point at a pixel to name its reporting unit."
          ) : (
            <>
              <strong className="font-semibold">{PIXELS.names[picked]}</strong>: {STATE_LABEL[pickedState ?? 0]} this week.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
