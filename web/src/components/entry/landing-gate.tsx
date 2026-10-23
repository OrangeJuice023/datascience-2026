"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Sigi, usePrefersReducedMotion } from "@/components/mascot/sigi";
import { PixelMap } from "./pixel-map";

/** Session flag: once a visitor has pressed start, "/" opens straight into the app. */
export const ENTERED_KEY = "sigma-entered";

const WIPE_COLS = 12;
const WIPE_ROWS = 8;

const WAYS_IN = [
  {
    href: "/lab",
    name: "Lab",
    verb: "Trace the national record",
    detail: "Weekly dengue cases for the Philippines, 2012–2023 (OpenDengue).",
    status: "Observed data",
  },
  {
    href: "/explore",
    name: "Explore",
    verb: "Read the map",
    detail: "EARS and DOH-threshold results for 126 reporting units, 2016–2021, with weekly weather for 12 cities.",
    status: "Observed data",
  },
  {
    href: "/policy",
    name: "Policy",
    verb: "Act on the evidence",
    detail: "Curated LGU evidence and a Copilot that cites it. Verify every answer before use.",
    status: "AI-assisted",
  },
  {
    href: "/access",
    name: "Access",
    verb: "Check medicine access",
    detail: "How facility reports and searches could show access gaps. Illustrative data for now.",
    status: "Demo",
  },
];

/**
 * The landing page shown when someone opens SIGMA's link. It sits over the
 * Overview at "/" and hands over to the app with a pixel "power on" wipe;
 * the choice is remembered for the session (see the root layout's script).
 * No route or navigation of the app changes.
 */
export function LandingGate() {
  const [open, setOpen] = useState(true);
  const [wipe, setWipe] = useState<"in" | "out" | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Random, fixed per mount, so the pixels fill in a scattered order.
  const delays = useMemo(
    () => Array.from({ length: WIPE_COLS * WIPE_ROWS }, (_, i) => ((i * 37) % 97) * 4),
    [],
  );

  const finish = useCallback(() => {
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {
      // Private mode: the landing simply shows again next time.
    }
    document.documentElement.dataset.sigmaEntered = "1";
    setOpen(false);
  }, []);

  const start = useCallback(() => {
    if (wipe) return;
    if (reducedMotion) {
      finish();
      return;
    }
    setWipe("in");
    window.setTimeout(() => {
      finish();
      setWipe("out");
      window.setTimeout(() => setWipe(null), 200);
    }, 560);
  }, [finish, reducedMotion, wipe]);

  useEffect(() => {
    // Already entered this session: CSS keeps the landing hidden, and it must
    // not take the Enter key from the app underneath.
    if (!open || document.documentElement.dataset.sigmaEntered) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.key === "Enter" && !target?.closest("a, button, input, textarea, select")) start();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, start]);

  return (
    <>
      {open && (
        <div
          id="sigma-entry"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sigma-entry-title"
          className="entry-paper fixed inset-0 z-[60] overflow-y-auto"
        >
          <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
            <span className="font-pixel text-xl text-[var(--entry-green-deep)]">SIGMA</span>
            <nav aria-label="Sections" className="hidden items-center gap-6 text-sm font-medium sm:flex">
              {WAYS_IN.map((w) => (
                <Link key={w.href} href={w.href} onClick={finish} className="hover:text-[var(--entry-green)]">
                  {w.name}
                </Link>
              ))}
              <Link href="/documentation" onClick={finish} className="hover:text-[var(--entry-green)]">
                Docs
              </Link>
            </nav>
          </header>

          <section className="relative mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-6xl flex-col items-center justify-center px-5 pb-16 text-center sm:px-8">
            <PixelCross className="entry-float absolute left-[6%] top-[14%] hidden h-10 w-10 text-[#d97a5c]/50 md:block" />
            <PixelCross className="entry-float absolute right-[8%] top-[22%] hidden h-14 w-14 text-[var(--entry-green)]/25 md:block" />
            <PixelCross className="entry-float absolute bottom-[18%] left-[12%] hidden h-8 w-8 text-[var(--entry-leaf)]/40 md:block" />

            <Sigi state="greeting" size={112} className="pixel-image" label="Sigi, the SIGMA companion, waving hello" />

            <h1 id="sigma-entry-title" className="font-pixel entry-title mt-4 text-[clamp(4.5rem,17vw,11rem)] leading-[0.9] tracking-tight">
              SIGMA
            </h1>
            <p className="mt-3 text-lg font-semibold text-[var(--entry-green-deep)] sm:text-xl">
              Spatial Intelligence &amp; Geographic Modeling for Action
            </p>
            <p className="font-pixel mt-6 text-balance text-2xl text-[var(--entry-ink)] sm:text-3xl">
              Every week a pixel. Every pixel a place.
            </p>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--entry-ink)] sm:text-lg">
              A dengue early-warning prototype for Philippine LGU health offices. It checks 126 reporting
              units week by week against EARS and DOH thresholds, on surveillance data from 2016 to 2021.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={start}
                className="entry-key font-pixel flex items-center gap-3 rounded-none bg-[var(--entry-green)] px-7 py-4 text-lg text-white sm:text-xl"
              >
                <span aria-hidden="true">▶</span>
                Ready to explore public health
              </button>
              <Link
                href="/documentation"
                onClick={finish}
                className="flex items-center gap-2 px-4 py-3 text-base font-semibold text-[var(--entry-green-deep)] underline-offset-4 hover:underline"
              >
                How SIGMA works
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="font-pixel mt-6 hidden text-sm text-[var(--entry-ink)]/70 sm:block">
              Press Enter<span className="entry-blink">_</span>
            </p>
          </section>

          <section aria-labelledby="sigma-entry-2019" className="bg-[var(--entry-cream)]/80 py-20 sm:py-28">
            <div className="mx-auto max-w-6xl px-5 sm:px-8">
              <h2 id="sigma-entry-2019" className="font-pixel text-3xl text-[var(--entry-green-deep)] sm:text-5xl">
                2019, one week at a time
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
                Each pixel is one of the 126 places that report dengue to the DOH. Watch the EARS alarms
                spread through the year the country declared a national dengue epidemic.
              </p>
              <div className="mt-12">
                <PixelMap />
              </div>
              <p className="mt-10 max-w-3xl text-sm leading-relaxed text-[var(--entry-ink)]/80">
                An EARS alarm marks a week that rose unusually fast against that place&apos;s own recent weeks.
                It is a retrospective statistical signal, not a forecast, a measure of risk or an official
                declaration. Pale pixels are weeks with no usable report; grey ones did not have enough recent weeks to compute.
              </p>
            </div>
          </section>

          <section aria-labelledby="sigma-entry-ways" className="py-20 sm:py-28">
            <div className="mx-auto max-w-6xl px-5 sm:px-8">
              <h2 id="sigma-entry-ways" className="font-pixel text-3xl text-[var(--entry-green-deep)] sm:text-5xl">
                Four ways in
              </h2>
              <ul className="mt-10 flex flex-col">
                {WAYS_IN.map((w) => (
                  <li key={w.href}>
                    <Link
                      href={w.href}
                      onClick={finish}
                      className="group grid gap-x-8 gap-y-1 py-5 sm:grid-cols-[10rem_minmax(0,1fr)_8rem] sm:items-baseline"
                    >
                      <span className="font-pixel text-2xl text-[var(--entry-green-deep)] group-hover:text-[var(--entry-green)]">
                        {w.name}
                      </span>
                      <span>
                        <span className="block text-lg font-semibold">{w.verb}</span>
                        <span className="block text-base text-[var(--entry-ink)]/80">{w.detail}</span>
                      </span>
                      <span className="text-sm font-medium text-[var(--entry-ink)]/70 sm:text-right">{w.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <footer className="bg-[var(--entry-green-deep)] py-16 text-[var(--entry-cream)]">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 sm:px-8">
              <p className="font-pixel text-[clamp(3rem,12vw,8rem)] leading-none">SIGMA</p>
              <p className="max-w-3xl text-sm leading-relaxed text-[var(--entry-cream)]/85">
                A prototype for the Philippine Junior Data Science Challenge 2026, not a validated public-health
                tool. Data: DOH Epidemiology Bureau dengue counts via HDX (Cirrolytix), CC BY; OpenDengue v1.3,
                CC BY 4.0; reporting-unit boundaries from geoBoundaries, CC BY 3.0 IGO, matched to OCHA COD-AB.
              </p>
            </div>
          </footer>
        </div>
      )}

      {wipe && (
        <div
          className="entry-wipe pointer-events-none fixed inset-0 z-[70] grid"
          data-phase={wipe}
          style={{ gridTemplateColumns: `repeat(${WIPE_COLS}, 1fr)`, gridTemplateRows: `repeat(${WIPE_ROWS}, 1fr)` }}
          aria-hidden="true"
        >
          {delays.map((d, i) => (
            <span key={i} className="bg-[var(--entry-green-deep)]" style={{ animationDelay: `${wipe === "in" ? d : d / 3}ms` }} />
          ))}
        </div>
      )}
    </>
  );
}

/** The medical cross, drawn on a 5x5 pixel grid. */
function PixelCross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 5 5" className={className} shapeRendering="crispEdges" aria-hidden="true">
      <path d="M2 0h1v2h2v1H3v2H2V3H0V2h2z" fill="currentColor" />
    </svg>
  );
}
