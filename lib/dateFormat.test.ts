import { describe, expect, it } from "vitest";
import { fmtDayMonthYear } from "./dateFormat";

describe("fmtDayMonthYear", () => {
  it("formats a typical date as DD/MM/YYYY", () => {
    // Build the date in local time so the expected string matches whichever
    // timezone the test runs in (CI may differ from a developer machine).
    const date = new Date(2025, 4, 8); // 2025-05-08, May (0-indexed)
    expect(fmtDayMonthYear(date.getTime())).toBe("08/05/2025");
  });

  it("zero-pads single-digit day and month", () => {
    const date = new Date(2025, 0, 3); // 2025-01-03
    expect(fmtDayMonthYear(date.getTime())).toBe("03/01/2025");
  });

  it("handles the last day of the year (no off-by-one)", () => {
    const date = new Date(2024, 11, 31); // 2024-12-31
    expect(fmtDayMonthYear(date.getTime())).toBe("31/12/2024");
  });

  it("handles the first day of the year", () => {
    const date = new Date(2026, 0, 1); // 2026-01-01
    expect(fmtDayMonthYear(date.getTime())).toBe("01/01/2026");
  });

  it("returns — for 0 (defensive: 0 is a valid epoch but means 'no date' in this UI)", () => {
    expect(fmtDayMonthYear(0)).toBe("—");
  });

  it("returns — for NaN", () => {
    expect(fmtDayMonthYear(Number.NaN)).toBe("—");
  });

  it("returns — for negative timestamps (rejected as invalid)", () => {
    expect(fmtDayMonthYear(-1)).toBe("—");
  });
});
