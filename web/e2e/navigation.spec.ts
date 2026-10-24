import { expect, test } from "@playwright/test";
import { PAGES, expectPage, openPage, pageTitle, prepareContext } from "./support";

test.describe("landing page", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await prepareContext(context, baseURL, { landing: true });
  });

  test("opens on the landing page, hands over to the Overview and remembers it", async ({ page }) => {
    await openPage(page, "/");
    const landing = page.getByRole("dialog", { name: "SIGMA" });
    await expect(landing).toBeVisible();

    await landing.getByRole("button", { name: "Ready to explore public health" }).click();
    await expect(landing).toBeHidden();
    await expectPage(page, PAGES.overview);

    // Remembered for the session: a reload opens straight into the app.
    await page.reload();
    await expectPage(page, PAGES.overview);
    await expect(page.getByRole("dialog", { name: "SIGMA" })).toBeHidden();
  });
});

test.describe("navigation", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await prepareContext(context, baseURL);
  });

  test("the primary tabs open Overview, Explore and Analyze", async ({ page }) => {
    await openPage(page, "/");
    await expectPage(page, PAGES.overview);
    const primary = page.getByRole("navigation", { name: "Primary" });

    await primary.getByRole("link", { name: "Explore" }).click();
    await expectPage(page, PAGES.explore);
    await expect(primary.getByRole("link", { name: "Explore" })).toHaveAttribute("aria-current", "page");

    // Analyze opens its first subtab, ACCESS, because ACCESS runs on ready
    // reference data (app/analyze/page.tsx).
    await primary.getByRole("link", { name: "Analyze" }).click();
    await expectPage(page, PAGES.access);
    await expect(primary.getByRole("link", { name: "Analyze" })).toHaveAttribute("aria-current", "page");

    await primary.getByRole("link", { name: "Overview" }).click();
    await expectPage(page, PAGES.overview);
    await expect(primary.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  test("Analyze's subtabs open ACCESS, Policy and Lab under SIGI", async ({ page }) => {
    await openPage(page, PAGES.access.path);
    await expectPage(page, PAGES.access);
    const subtabs = page.getByRole("navigation", { name: "Analyze" });

    for (const target of [PAGES.policy, PAGES.lab, PAGES.access]) {
      const tab = subtabs.getByRole("link", { name: target.name, exact: true });
      await tab.click();
      await expectPage(page, target);
      await expect(tab).toHaveAttribute("aria-current", "page");
    }
  });

  test("Data Sources and Documentation open from the menu", async ({ page }) => {
    await openPage(page, "/");
    const primary = page.getByRole("navigation", { name: "Primary" });

    await primary.getByRole("link", { name: "Data Sources" }).click();
    await expectPage(page, PAGES.dataSources);

    await primary.getByRole("link", { name: "Documentation" }).click();
    await expectPage(page, PAGES.documentation);
  });

  // next.config.ts redirects the old addresses; /simulate lands on /analyze,
  // which opens its first subtab.
  const REDIRECTS = [
    { from: "/lab", location: "/analyze/lab", lands: PAGES.lab },
    { from: "/policy", location: "/analyze/policy", lands: PAGES.policy },
    { from: "/access", location: "/analyze/access", lands: PAGES.access },
    { from: "/simulate", location: "/analyze", lands: PAGES.access },
  ];
  for (const { from, location, lands } of REDIRECTS) {
    test(`the old address ${from} redirects to ${lands.path}`, async ({ page, request }) => {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toBe(location);

      await openPage(page, from);
      await expectPage(page, lands);
    });
  }
});

test.describe("phone navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ context, baseURL }) => {
    await prepareContext(context, baseURL);
  });

  test("the menu button opens the navigation, which closes after a choice", async ({ page }) => {
    await openPage(page, "/");
    await expect(pageTitle(page, "SIGMA")).toBeVisible();

    await page.getByRole("button", { name: "Open navigation" }).click();
    const menu = page.getByRole("dialog", { name: "Navigation" });
    await menu.getByRole("link", { name: "Explore" }).click();
    await expectPage(page, PAGES.explore);
    await expect(menu).toBeHidden();
  });
});
