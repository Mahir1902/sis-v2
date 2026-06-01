import { describe, expect, it } from "vitest";
import {
  computeInvoiceTotals,
  formatInvoiceNumber,
  nextInvoiceSequence,
  parseInvoiceNumber,
} from "./invoiceUtils";

describe("formatInvoiceNumber", () => {
  it("formats sequence 1 as INV-2024-001 from '2024-2025'", () => {
    expect(formatInvoiceNumber("2024-2025", 1)).toBe("INV-2024-001");
  });

  it("pads sequences below 1000 to 3 digits", () => {
    expect(formatInvoiceNumber("2024-2025", 7)).toBe("INV-2024-007");
    expect(formatInvoiceNumber("2024-2025", 42)).toBe("INV-2024-042");
    expect(formatInvoiceNumber("2024-2025", 999)).toBe("INV-2024-999");
  });

  it("does not truncate sequences above 999 — uses natural width past 3 digits", () => {
    expect(formatInvoiceNumber("2024-2025", 1000)).toBe("INV-2024-1000");
    expect(formatInvoiceNumber("2024-2025", 12345)).toBe("INV-2024-12345");
  });

  it("uses only the first 4 characters of the academic year label", () => {
    expect(formatInvoiceNumber("2025-2026", 3)).toBe("INV-2025-003");
    // A single-year label is also accepted (first 4 chars taken)
    expect(formatInvoiceNumber("2025", 3)).toBe("INV-2025-003");
  });

  it("throws on non-positive sequence", () => {
    expect(() => formatInvoiceNumber("2024-2025", 0)).toThrow();
    expect(() => formatInvoiceNumber("2024-2025", -1)).toThrow();
  });

  it("throws on non-integer sequence", () => {
    expect(() => formatInvoiceNumber("2024-2025", 1.5)).toThrow();
  });

  it("throws on malformed year label (first 4 chars not all digits)", () => {
    expect(() => formatInvoiceNumber("abcd-2025", 1)).toThrow();
    expect(() => formatInvoiceNumber("20a4-2025", 1)).toThrow();
    expect(() => formatInvoiceNumber("", 1)).toThrow();
  });
});

describe("parseInvoiceNumber", () => {
  it("parses a well-formed invoice number", () => {
    expect(parseInvoiceNumber("INV-2024-001")).toEqual({
      year: "2024",
      sequence: 1,
    });
  });

  it("parses an invoice number with sequence > 999", () => {
    expect(parseInvoiceNumber("INV-2024-1000")).toEqual({
      year: "2024",
      sequence: 1000,
    });
  });

  it("round-trips formatInvoiceNumber output", () => {
    const cases: Array<[string, number]> = [
      ["2024-2025", 1],
      ["2024-2025", 42],
      ["2025-2026", 999],
      ["2025-2026", 1500],
    ];
    for (const [year, seq] of cases) {
      const formatted = formatInvoiceNumber(year, seq);
      const parsed = parseInvoiceNumber(formatted);
      expect(parsed).not.toBeNull();
      expect(parsed?.sequence).toBe(seq);
      expect(parsed?.year).toBe(year.slice(0, 4));
    }
  });

  it("returns null on missing INV prefix", () => {
    expect(parseInvoiceNumber("2024-001")).toBeNull();
    expect(parseInvoiceNumber("FOO-2024-001")).toBeNull();
  });

  it("returns null on missing year segment", () => {
    expect(parseInvoiceNumber("INV--001")).toBeNull();
    expect(parseInvoiceNumber("INV-001")).toBeNull();
  });

  it("returns null on non-numeric year", () => {
    expect(parseInvoiceNumber("INV-abcd-001")).toBeNull();
  });

  it("returns null on non-numeric sequence", () => {
    expect(parseInvoiceNumber("INV-2024-abc")).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(parseInvoiceNumber("")).toBeNull();
  });

  it("returns null on extra segments", () => {
    expect(parseInvoiceNumber("INV-2024-001-2")).toBeNull();
  });

  it("returns null when year does not have exactly 4 digits", () => {
    expect(parseInvoiceNumber("INV-202-001")).toBeNull();
    expect(parseInvoiceNumber("INV-20245-001")).toBeNull();
  });
});

describe("computeInvoiceTotals", () => {
  it("returns zeros for empty line items", () => {
    expect(computeInvoiceTotals([], 0)).toEqual({
      totalAmount: 0,
      balance: 0,
    });
  });

  it("sums line items and returns total minus paid as balance", () => {
    expect(
      computeInvoiceTotals(
        [{ amount: 1000 }, { amount: 500 }, { amount: 250 }],
        300,
      ),
    ).toEqual({ totalAmount: 1750, balance: 1450 });
  });

  it("rounds totals to 2 decimal places", () => {
    expect(
      computeInvoiceTotals([{ amount: 10.123 }, { amount: 20.456 }], 0),
    ).toEqual({ totalAmount: 30.58, balance: 30.58 });
  });

  it("clamps balance to 0 when paid exceeds total", () => {
    expect(computeInvoiceTotals([{ amount: 100 }], 250)).toEqual({
      totalAmount: 100,
      balance: 0,
    });
  });

  it("handles negative paid amount as if it were 0 (no inflation of balance)", () => {
    // Defensive: paid should never be negative, but we still clamp the balance.
    const result = computeInvoiceTotals([{ amount: 100 }], -50);
    expect(result.totalAmount).toBe(100);
    expect(result.balance).toBeLessThanOrEqual(100);
    expect(result.balance).toBeGreaterThanOrEqual(0);
  });

  it("does not lose precision on financial rounding (banker-safe two decimal)", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754 — must round to 0.30.
    const result = computeInvoiceTotals([{ amount: 0.1 }, { amount: 0.2 }], 0);
    expect(result.totalAmount).toBe(0.3);
  });

  it("treats zero-amount line items as legitimate (no exclusion)", () => {
    expect(computeInvoiceTotals([{ amount: 0 }, { amount: 100 }], 0)).toEqual({
      totalAmount: 100,
      balance: 100,
    });
  });
});

describe("nextInvoiceSequence", () => {
  it("returns 1 when there are no existing numbers", () => {
    expect(nextInvoiceSequence([], "2024")).toBe(1);
  });

  it("returns max+1 for the target year", () => {
    expect(
      nextInvoiceSequence(
        ["INV-2024-001", "INV-2024-003", "INV-2024-002"],
        "2024",
      ),
    ).toBe(4);
  });

  it("ignores invoice numbers from other years", () => {
    expect(
      nextInvoiceSequence(
        ["INV-2023-005", "INV-2024-001", "INV-2025-099"],
        "2024",
      ),
    ).toBe(2);
  });

  it("returns 1 when no existing numbers match the target year", () => {
    expect(nextInvoiceSequence(["INV-2023-005", "INV-2025-099"], "2024")).toBe(
      1,
    );
  });

  it("ignores malformed entries", () => {
    expect(
      nextInvoiceSequence(
        ["INV-2024-001", "garbage", "INV-2024-abc", "", "INV-2024-005"],
        "2024",
      ),
    ).toBe(6);
  });

  it("handles sequence values above 999 correctly", () => {
    expect(nextInvoiceSequence(["INV-2024-998", "INV-2024-1000"], "2024")).toBe(
      1001,
    );
  });

  it("returns 1 when the only entries for the target year are malformed", () => {
    expect(nextInvoiceSequence(["INV-2024-abc", "INV-2024-"], "2024")).toBe(1);
  });
});
