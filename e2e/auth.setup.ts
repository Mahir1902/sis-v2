import { test as setup } from "@playwright/test";

// This file contains auth setup for authenticated test runs.
// For now it's a placeholder — actual E2E auth requires a running Convex backend.
// Smoke tests in smoke.spec.ts cover unauthenticated flows.

setup("authenticate", async () => {
  // Placeholder — real auth setup would use test credentials
  console.log("Auth setup: skipped (requires live Convex backend)");
});
