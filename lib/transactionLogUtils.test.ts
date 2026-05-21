import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatLineItem,
  formatTransactionDate,
  getStatusBadgeStyle,
} from "./transactionLogUtils";

describe("formatCurrency", () => {
  it("formats zero as ৳0", () => {
    expect(formatCurrency(0)).toBe("৳0");
  });

  it("formats whole numbers without decimals", () => {
    expect(formatCurrency(1000)).toBe("৳1,000");
  });

  it("formats large amounts with comma separators", () => {
    expect(formatCurrency(150000)).toBe("৳1,50,000");
  });

  it("formats decimal amounts to 2 places", () => {
    expect(formatCurrency(1234.5)).toBe("৳1,234.50");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-500)).toBe("-৳500");
  });
});

describe("formatTransactionDate", () => {
  it("formats a Unix ms timestamp to readable date", () => {
    // Jan 15, 2025 at midnight UTC
    const timestamp = new Date("2025-01-15T00:00:00Z").getTime();
    const result = formatTransactionDate(timestamp);
    // Should contain "Jan" and "15" and "2025"
    expect(result).toContain("Jan");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("formats a different date correctly", () => {
    // Dec 25, 2024
    const timestamp = new Date("2024-12-25T00:00:00Z").getTime();
    const result = formatTransactionDate(timestamp);
    expect(result).toContain("Dec");
    expect(result).toContain("25");
    expect(result).toContain("2024");
  });
});

describe("getStatusBadgeStyle", () => {
  it("returns green style for completed status", () => {
    const style = getStatusBadgeStyle("completed");
    expect(style).toContain("green");
  });

  it("returns red style for voided status", () => {
    const style = getStatusBadgeStyle("voided");
    expect(style).toContain("red");
  });

  it("returns gray style for unknown status", () => {
    const style = getStatusBadgeStyle("unknown");
    expect(style).toContain("gray");
  });
});

describe("formatLineItem", () => {
  it("formats a complete line item", () => {
    const result = formatLineItem({
      amount: 1500,
      feeStructureName: "Tuition Fee",
      billingPeriod: "2025-01",
    });
    expect(result.label).toBe("Tuition Fee");
    expect(result.amount).toBe("৳1,500");
    expect(result.period).toContain("Jan");
  });

  it("uses dash for missing fee structure name", () => {
    const result = formatLineItem({ amount: 500 });
    expect(result.label).toBe("—");
  });

  it("uses dash for missing billing period", () => {
    const result = formatLineItem({
      amount: 500,
      feeStructureName: "Sports",
    });
    expect(result.period).toBe("—");
  });

  it("formats zero amount", () => {
    const result = formatLineItem({ amount: 0 });
    expect(result.amount).toBe("৳0");
  });
});
