// Registers @testing-library/jest-dom matchers (e.g. toBeInTheDocument) with
// vitest's expect, even under globals: false.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// With globals: false, RTL's automatic per-test cleanup (normally registered
// via the global afterEach) never runs, so rendered DOM leaks between tests in
// the same file. Register it explicitly so each test starts from a clean
// document. This is imported explicitly from "vitest" to stay compatible with
// the globals: false harness the pure-logic lib tests rely on.
afterEach(() => {
  cleanup();
});
