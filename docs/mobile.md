# SIGMA — Mobile support

Describes `main` at `8be0e89` (2026-10-19). §1–§2 describe what the code
does. §3 onward are recommendations.

## 1. Current state (verified in code)

**SIGMA is a responsive web app only.** There is:

- no native or cross-platform mobile app (no React Native, Expo, Capacitor,
  Flutter, `android/` or `ios/` directory);
- no Progressive Web App setup (no `manifest`, no service worker, no
  offline cache);
- no mobile-specific API: the app has no HTTP API at all ([api.md](api.md));
- no authentication.

Nothing has been tested on a physical phone or tablet. No test record exists
in the repo.

## 2. Responsive behaviour present today

| Area | Implementation | File |
| --- | --- | --- |
| Navigation | Sidebar (`w-64`) from the `md` breakpoint (768 px) up. Below it, a menu button opens a slide-over drawer (`w-72 max-w-[85vw]`) with backdrop tap and Escape to close; links close it on navigate | `web/src/components/layout/app-shell.tsx`, `top-bar.tsx`, `sidebar.tsx` |
| Page padding | `px-4 py-5`, then `sm:px-6 sm:py-6` | `app-shell.tsx` |
| Top bar | Subtitle hidden below `sm`; prototype badge shortened to "Prototype" | `top-bar.tsx` |
| Grids | Single column on phones, then `sm:` / `lg:` / `xl:` columns (e.g. Simulate controls sit beside the map only at `xl`) | page views |
| Tables | Wrapped in `overflow-x-auto` with a minimum width (`min-w-[640px]` signal table, `480px` Ask-the-data, `420px` comparison), so they scroll sideways on phones | `components/dashboard/signal-table.tsx`, `components/lab/*` |
| Charts | Recharts `ResponsiveContainer` (30 uses) resizes to the container width | `components/charts/*`, `components/lab/national/*` |
| Analytical map | Height `h-[60vh] min-h-[22rem]`, fixed `34rem` from `lg`. Map engine is client-only (`dynamic(..., { ssr: false })`) with a "Loading map engine…" placeholder | `components/maps/analytical/analytical-map.tsx` |
| Small maps | Fixed heights (`h-72`, `h-80`, `sm:h-96`) | `components/maps/map-panel.tsx`, `app/overview-view.tsx`, `app/simulate/page.tsx` |
| No-WebGL fallback | Schematic view without basemap, 3D or globe | `components/maps/map-fallback.tsx`, `map-canvas.tsx` |
| Viewport | Next.js App Router emits a default `width=device-width, initial-scale=1` viewport. No custom `viewport` export | `web/src/app/layout.tsx` (absence verified) |

## 3. Known and likely usability limits on small screens

Inferred from the code, not observed on devices. Confirm each in §7.

- **Map gestures.** MapLibre's default handlers are used. There is no
  cooperative-gesture mode, so a one-finger drag over a 60vh map pans the
  map, not the page, which makes the page hard to scroll past the map.
- **3D and Globe views** (deck.gl columns, terrain, globe projection) are GPU
  heavy and may be slow on low-end Android phones.
- **Small text.** 65 places use `text-[10px]` or `text-[11px]` (badges,
  labels, legends), which is below common mobile readability guidance.
- **Tap targets.** The menu and close buttons are about 32 px (`p-1.5` +
  20 px icon), below the 44–48 px common guidance. Chart tooltips rely on
  hover and touch-move.
- **Wide tables** need horizontal scrolling with no visual cue.
- **Explore layout** stacks the map, filters, detail panel and lists into one
  long column below `lg`.

## 4. Network and performance constraints

- MapLibre GL, four deck.gl packages and Recharts are the heaviest client
  dependencies. Only the analytical map is code-split. `MapPanel` imports
  `maplibre-gl` directly. Bundle size has not been measured.
- Basemap tiles come from MapTiler or `tile.openstreetmap.org` and need a
  connection. There is no offline mode.
- Data is small and server-rendered (national weekly series, demo bundles),
  so page payloads are modest. `/explore` sends the largest bundle.

## 5. Dependencies a mobile client would need

| Need | Today |
| --- | --- |
| Data API | None; data arrives only as RSC props |
| Authentication | None |
| Environment | Only the public `NEXT_PUBLIC_*` map variables |
| Offline data | None |

## 6. Options for future mobile delivery

| Option | Effort | Pros | Cons / prerequisites |
| --- | --- | --- | --- |
| A. Harden the responsive site | Low | One codebase; already mostly in place | No install or offline use; fix §3 items |
| B. PWA (manifest + service worker caching the shell and last-loaded data) | Low–medium | Installable; partial offline use | Map tiles are hard to cache within licence terms; needs a deploy with HTTPS (P2-3) |
| C. Capacitor wrapper around the site | Medium | App-store presence | Same web UI; store review overhead; little gain without native features |
| D. Native / React Native app | High | Best performance and offline use | Needs a stable JSON API, auth and a second UI codebase (P3-3); not justified at prototype stage |

Recommendation: A now, and B after a verified deploy. Revisit C or D only if
field users need offline or app-store distribution.

## 7. Recommended validation devices and sizes

| Class | Example | CSS width |
| --- | --- | --- |
| Small Android (low-end GPU) | Samsung Galaxy A-series | 360 px |
| Mid iPhone | iPhone 13/14/15 | 390 px |
| Large phone | iPhone Pro Max / Pixel Pro | 412–430 px |
| Tablet portrait | iPad | 768 px (the `md` breakpoint) |
| Tablet landscape / small laptop | iPad landscape | 1024 px (`lg`) |

Test on Chrome for Android and Safari for iOS, on throttled 3G/4G, and in
both orientations.

## 8. Mobile-readiness checklist

- [ ] Every route loads and is readable at 360 px with no horizontal page scroll (tables excepted).
- [ ] Drawer opens, closes (tap outside, close button, Escape on keyboard) and navigates.
- [ ] Page scrolls past each map with one finger; map pans with two fingers or after a tap (decide on cooperative gestures).
- [ ] 2D map usable on a low-end Android device; 3D and Globe either usable or hidden on small screens.
- [ ] OSM fallback and no-WebGL fallback render on a phone.
- [ ] Chart tooltips reachable by tap.
- [ ] Tap targets ≥ 44 px for navigation and primary controls.
- [ ] Body and badge text legible (review `text-[10px]` / `text-[11px]`).
- [ ] Demo / FORMAL / MODEL labels remain visible at small widths.
- [ ] Lighthouse mobile run recorded (performance, accessibility), with bundle sizes.
- [ ] Results and defects linked from [next-steps.md](next-steps.md) P2-8.
