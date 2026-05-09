import { describe, expect, it } from "vitest";
import { formatBillingPeriod } from "./formatBillingPeriod";

describe("formatBillingPeriod", () => {
  it("formats a standard YYYY-MM string to 'Mon YYYY'", () => {
    expect(formatBillingPeriod("2025-01")).toBe("Jan 2025");
    expect(formatBillingPeriod("2025-06")).toBe("Jun 2025");
    expect(formatBillingPeriod("2025-12")).toBe("Dec 2025");
  });

  it("returns '—' for undefined", () => {
    expect(formatBillingPeriod(undefined)).toBe("—");
  });

  it("returns '—' for null (cast as undefined)", () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing edge case
    expect(formatBillingPeriod(null as any)).toBe("—");
  });

  it("returns '—' for empty string", () => {
    expect(formatBillingPeriod("")).toBe("—");
  });

  it("handles January correctly (month index boundary)", () => {
    expect(formatBillingPeriod("2025-01")).toBe("Jan 2025");
  });

  it("handles December correctly (month index boundary)", () => {
    expect(formatBillingPeriod("2025-12")).toBe("Dec 2025");
  });

  it("handles year boundaries (Dec to Jan transition)", () => {
    expect(formatBillingPeriod("2024-12")).toBe("Dec 2024");
    expect(formatBillingPeriod("2025-01")).toBe("Jan 2025");
  });

  it("formats all 12 months correctly", () => {
    const expected = [
      ["2025-01", "Jan 2025"],
      ["2025-02", "Feb 2025"],
      ["2025-03", "Mar 2025"],
      ["2025-04", "Apr 2025"],
      ["2025-05", "May 2025"],
      ["2025-06", "Jun 2025"],
      ["2025-07", "Jul 2025"],
      ["2025-08", "Aug 2025"],
      ["2025-09", "Sep 2025"],
      ["2025-10", "Oct 2025"],
      ["2025-11", "Nov 2025"],
      ["2025-12", "Dec 2025"],
    ];

    for (const [input, output] of expected) {
      expect(formatBillingPeriod(input)).toBe(output);
    }
  });

  it("handles different years", () => {
    expect(formatBillingPeriod("2020-03")).toBe("Mar 2020");
    expect(formatBillingPeriod("2030-07")).toBe("Jul 2030");
  });
});
