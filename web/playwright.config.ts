import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (e2e/), in Chromium, against a production build served by
 * `next start` on a port of its own, the way the site runs when deployed.
 *
 * A local `npm run e2e` builds first, so it never tests a stale `.next`
 * folder. CI builds in its own step and sets E2E_SKIP_BUILD=1 to skip the
 * second build. No test reaches a model: every SIGI test mocks /api/v1/chat in
 * the browser, and the test server refuses chat requests anyway.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const START = `npm run start -- --hostname 127.0.0.1 --port ${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // One retry on CI absorbs a slow runner; a test that needed it is reported as flaky.
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    colorScheme: "light",
    // The landing wipe, Sigi and CSS transitions finish at once (globals.css).
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? START : `npm run build && ${START}`,
    url: `${BASE_URL}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 10 * 60_000,
    env: {
      // process.env wins over .env files, so a local GROQ_API_KEY is never used.
      CHAT_DISABLED: "true",
    },
  },
});
