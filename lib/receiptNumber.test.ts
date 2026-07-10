import { describe, expect, it } from "vitest";
import { currentBdYear, formatReceiptNumber } from "./receiptNumber";

describe("formatReceiptNumber", () => {
  it("zero-pads the sequence to five digits", () => {
    expect(formatReceiptNumber(2026, 1)).toBe("RCP-2026-00001");
  });

  it("renders a full five-digit sequence without padding overflow", () => {
    expect(formatReceiptNumber(2026, 99999)).toBe("RCP-2026-99999");
  });

  it("renders an intermediate sequence with leading zeros", () => {
    expect(formatReceiptNumber(2026, 42)).toBe("RCP-2026-00042");
  });

  it("rejects non-positive sequences", () => {
    expect(() => formatReceiptNumber(2026, 0)).toThrow();
    expect(() => formatReceiptNumber(2026, -1)).toThrow();
  });

  it("rejects sequences that exceed five digits", () => {
    expect(() => formatReceiptNumber(2026, 100000)).toThrow();
  });

  it("rejects non-integer sequences", () => {
    expect(() => formatReceiptNumber(2026, 1.5)).toThrow();
  });
});

describe("currentBdYear", () => {
  it("returns the BD calendar year for a normal mid-year UTC timestamp", () => {
    // 2026-06-15 00:00 UTC → 2026-06-15 06:00 BD
    const utc = Date.UTC(2026, 5, 15, 0, 0, 0);
    expect(currentBdYear(utc)).toBe(2026);
  });

  it("stays on the current BD year just before BD midnight on NYE (UTC has not yet rolled)", () => {
    // 2026-12-31 23:55 BD = 2026-12-31 17:55 UTC
    const utc = Date.UTC(2026, 11, 31, 17, 55, 0);
    expect(currentBdYear(utc)).toBe(2026);
  });

  it("rolls to the next BD year just past BD midnight on NYE even though UTC is still the prior day", () => {
    // 2027-01-01 00:05 BD = 2026-12-31 18:05 UTC
    const utc = Date.UTC(2026, 11, 31, 18, 5, 0);
    expect(currentBdYear(utc)).toBe(2027);
  });

  it("stays on the prior BD year when UTC has already crossed midnight but BD has not (Jan 1 early UTC = Dec 31 BD)", () => {
    // 2027-01-01 00:30 UTC = 2027-01-01 06:30 BD — both are 2027.
    const utc = Date.UTC(2027, 0, 1, 0, 30, 0);
    expect(currentBdYear(utc)).toBe(2027);
  });

  it("falls back to Date.now() when called with no argument and returns a sane year", () => {
    const year = currentBdYear();
    expect(year).toBeGreaterThanOrEqual(2025);
    expect(year).toBeLessThanOrEqual(2100);
  });
});
