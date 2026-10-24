import { expect, test } from "@playwright/test";
import { PAGES, expectPage, horizontalOverflow, openPage, prepareContext } from "./support";

/** At phone width no page may scroll sideways; wide tables and code scroll inside their own box. */
test.describe("phone width (390 px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ context, baseURL }) => {
    await prepareContext(context, baseURL);
  });

  for (const target of Object.values(PAGES)) {
    test(`${target.name} does not scroll sideways`, async ({ page }) => {
      await openPage(page, target.path);
      await expectPage(page, target);

      const { scrollWidth, clientWidth, offenders } = await horizontalOverflow(page);
      expect(scrollWidth, `${target.path} is wider than the screen:\n${offenders.join("\n")}`).toBeLessThanOrEqual(
        clientWidth + 1,
      );
    });
  }
});
