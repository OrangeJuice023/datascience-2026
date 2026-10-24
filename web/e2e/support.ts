import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

/**
 * Shared set-up for the end-to-end tests.
 */

/** Session flags read by the root layout before paint (components/entry/). */
const BOOTED_KEY = "sigma-booted";
const ENTERED_KEY = "sigma-entered";

/**
 * Prepares a test's browser context:
 * - only the app's own origin is reachable, so a run never depends on a third
 *   party (the map's OpenStreetMap tiles fail, and the map says so);
 * - the boot splash counts as seen, and so does the landing page unless
 *   `landing` is true.
 */
export async function prepareContext(
  context: BrowserContext,
  baseURL: string | undefined,
  { landing = false }: { landing?: boolean } = {},
) {
  const origin = new URL(baseURL ?? "http://127.0.0.1").origin;
  await context.route((url) => url.origin !== origin, (route) => route.abort());
  await context.addInitScript((keys) => {
    try {
      for (const key of keys) window.sessionStorage.setItem(key, "1");
    } catch {
      // about:blank has no storage; the app's pages do.
    }
  }, landing ? [BOOTED_KEY] : [BOOTED_KEY, ENTERED_KEY]);
}

/**
 * Opens a page and waits until it can be used. The boot splash is rendered on
 * the server and removed by its own effect once the page and its fonts have
 * loaded, so once it is gone React is running and the layout is final.
 */
export async function openPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("#sigma-boot")).toHaveCount(0);
}

/** The page's level-1 heading, which every page has exactly one of. */
export function pageTitle(page: Page, name: string) {
  return page.getByRole("heading", { level: 1, name, exact: true });
}

export interface AppPage {
  name: string;
  path: string;
  title: string;
  /** Shown once the page's own content has rendered, including what it loads in the browser. */
  ready: (page: Page) => Locator;
}

export const PAGES = {
  overview: {
    name: "Overview",
    path: "/",
    title: "SIGMA",
    ready: (page) => page.getByRole("heading", { name: "Coverage", exact: true }),
  },
  explore: {
    name: "Explore",
    path: "/explore",
    title: "Signal Explorer",
    // The timeline appears once the reporting-unit results have loaded.
    ready: (page) => page.getByRole("slider", { name: "Timeline position" }),
  },
  access: {
    name: "ACCESS",
    path: "/analyze/access",
    title: "ACCESS",
    ready: (page) => page.getByRole("heading", { name: "Dengue medicines: what the public sector paid" }),
  },
  policy: {
    name: "Policy",
    path: "/analyze/policy",
    title: "Policy",
    ready: (page) => page.getByRole("heading", { name: "Evidence SIGI receives for Quezon City" }),
  },
  lab: {
    name: "Lab",
    path: "/analyze/lab",
    title: "SIGMA Lab",
    ready: (page) => page.getByRole("tab", { name: "National trend", selected: true }),
  },
  dataSources: {
    name: "Data Sources",
    path: "/data-sources",
    title: "Data sources",
    ready: (page) => page.getByRole("navigation", { name: "Sections on this page" }),
  },
  documentation: {
    name: "Documentation",
    path: "/documentation",
    title: "API documentation",
    ready: (page) => pageTitle(page, "API documentation"),
  },
} satisfies Record<string, AppPage>;

/** SIGI's frame, which sits above every Analyze subtab (app/analyze/layout.tsx). */
export function sigiHero(page: Page) {
  return page.getByRole("region", { name: "Ask SIGI" });
}

/** The browser is on `target` and its content has rendered. */
export async function expectPage(page: Page, target: AppPage) {
  await expect(page).toHaveURL(target.path);
  await expect(pageTitle(page, target.title)).toBeVisible();
  await expect(target.ready(page)).toBeVisible();
  if (target.path.startsWith("/analyze/")) await expect(sigiHero(page)).toBeVisible();
}

/**
 * How far the page scrolls sideways, with the elements that stick out past
 * the right edge (outside any scrolling container) so a failure names them.
 */
export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const width = root.clientWidth;
    const clipped = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== "visible") return true;
      }
      return false;
    };
    const offenders = [...document.body.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > width + 1 && !clipped(el))
      .slice(0, 5)
      .map((el) => {
        const label = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${[...el.classList].slice(0, 4).join(".")}`;
        return `${label} (right ${Math.round(el.getBoundingClientRect().right)}px): ${(el.textContent ?? "").trim().slice(0, 60)}`;
      });
    return { scrollWidth: root.scrollWidth, clientWidth: width, offenders };
  });
}
