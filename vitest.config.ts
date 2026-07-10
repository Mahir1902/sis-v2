import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Mirror tsconfig.json paths ("@/*": ["./*"]) so `@/...` imports resolve in tests.
const alias = { "@": path.resolve(__dirname, ".") };

// Two projects because the suites need different runtimes: the pure-logic +
// component tests run in jsdom, while the convex-test integration tests
// (convex/**/*.test.ts) need the edge-runtime environment convex functions run in.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "unit",
          // Globals off — existing lib/*.test.ts import { describe, it, expect }.
          globals: false,
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["**/*.test.{ts,tsx}"],
          exclude: [
            "**/node_modules/**",
            "**/.next/**",
            "**/.sandcastle/**",
            "e2e/**",
            "convex/**",
          ],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "convex",
          globals: false,
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/.sandcastle/**"],
          // convex-test resolves modules via import.meta.glob; inline it so the
          // edge-runtime env doesn't try to externalise it.
          server: { deps: { inline: ["convex-test"] } },
        },
      },
    ],
  },
});
