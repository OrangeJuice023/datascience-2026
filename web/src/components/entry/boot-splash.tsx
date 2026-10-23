"use client";

import { useEffect, useState } from "react";
import { Sigi } from "@/components/mascot/sigi";

/** Session flag: the splash shows on the first load of a session only. */
export const BOOTED_KEY = "sigma-booted";

/** Long enough not to flicker on a fast load; it never waits longer than the page. */
const MIN_VISIBLE_MS = 450;
const LOADER_PIXELS = 8;

type Phase = "page" | "fonts" | "ready";

const PHASE_TEXT: Record<Phase, string> = {
  page: "Loading the page",
  fonts: "Loading type",
  ready: "Ready",
};

/**
 * The first screen a visitor sees when the link opens. It is rendered on the
 * server, so it paints before any script, and it leaves as soon as the page
 * has really loaded: the status line names what it is waiting for, and
 * there is no progress figure because none would be true. A CSS fail-safe in
 * globals.css hides it after 6 s if this script never runs.
 */
export function BootSplash() {
  const [phase, setPhase] = useState<Phase>("page");
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const shownAt = performance.now();
    const pageLoaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));

    pageLoaded
      .then(() => {
        if (!cancelled) setPhase("fonts");
        return document.fonts?.ready;
      })
      .then(() => {
        if (cancelled) return;
        setPhase("ready");
        const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt));
        window.setTimeout(() => {
          if (cancelled) return;
          try {
            sessionStorage.setItem(BOOTED_KEY, "1");
          } catch {
            // Private mode: the splash shows again on the next load.
          }
          document.documentElement.dataset.sigmaBooted = "1";
          setGone(true);
        }, wait);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (gone) return null;
  return (
    <div
      id="sigma-boot"
      role="status"
      aria-live="polite"
      className="entry-paper fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <Sigi state="thinking" size={128} className="pixel-image" label="Sigi, the SIGMA companion, getting ready" />
      <p className="font-pixel entry-title text-6xl leading-none sm:text-7xl">SIGMA</p>
      <div className="entry-loader flex gap-1.5" aria-hidden="true">
        {Array.from({ length: LOADER_PIXELS }, (_, i) => (
          <span key={i} className="h-3 w-3" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <p className="font-pixel text-base text-[var(--entry-ink)]">
        {PHASE_TEXT[phase]}
        {phase !== "ready" && <span className="entry-blink">_</span>}
      </p>
    </div>
  );
}
