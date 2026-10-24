import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig, type Plugin } from "vitest/config";

/**
 * Test configuration for the SIGMA API.
 *
 * The API is server code, so the tests run in a Node environment. The two
 * path aliases mirror `tsconfig.json`: `@/` is the app's source tree and
 * `@sigma/contracts` is the shared contract package outside this folder.
 */

/**
 * `import "server-only"` is a build-time guard that the Next.js bundler
 * resolves; it throws when it is imported outside a server context, which
 * includes a plain Node test run. The guard is not what these tests check,
 * so it is stubbed out here.
 */
function serverOnlyStub(): Plugin {
  return {
    name: "server-only-stub",
    resolveId(id) {
      return id === "server-only" ? "\0server-only" : null;
    },
    load(id) {
      return id === "\0server-only" ? "export {};" : null;
    },
  };
}

export default defineConfig({
  plugins: [serverOnlyStub()],
  resolve: {
    alias: {
      "@sigma/contracts": fileURLToPath(new URL("../packages/sigma-contracts/src/index.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // The browser tests in e2e/ run under Playwright (npm run e2e), never here.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
