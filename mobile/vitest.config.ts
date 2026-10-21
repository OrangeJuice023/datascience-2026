import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Test configuration for the Expo client.
 *
 * The tests cover the API client and the settings helpers, which are plain
 * TypeScript with no native dependency. The path aliases mirror
 * `tsconfig.json`.
 */
export default defineConfig({
  // The Expo tsconfig extends `expo/tsconfig.base`, a package reference the
  // test transform cannot resolve. Passing the compiler options as a raw
  // tsconfig string tells the transform to stop looking for a file. The
  // tests are plain TypeScript, so the options are the same ones the app
  // uses.
  esbuild: {
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        target: "esnext",
        module: "esnext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        useDefineForClassFields: true,
        strict: true,
      },
    }),
  },
  resolve: {
    alias: {
      "@sigma/contracts": fileURLToPath(new URL("../packages/sigma-contracts/src/index.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
