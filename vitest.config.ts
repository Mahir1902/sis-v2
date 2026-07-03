import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror tsconfig.json paths ("@/*": ["./*"]) so `@/...` imports
      // resolve inside test files, including .test.tsx component tests.
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // Keep globals off so the existing lib/*.test.ts files — which import
    // { describe, it, expect } explicitly from "vitest" — are unaffected.
    globals: false,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Pick up both the existing pure-logic .test.ts files and new .test.tsx
    // component tests. Playwright specs live in e2e/ and are excluded.
    include: ["**/*.test.{ts,tsx}"],
    // Deep globs (**/) so nested node_modules — e.g. inside .sandcastle
    // worktrees — and third-party package tests never leak into our suite.
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.sandcastle/**",
      "e2e/**",
    ],
  },
});
