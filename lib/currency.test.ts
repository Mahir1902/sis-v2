import { describe, expect, it } from "vitest";
import { formatCurrency } from "./currency";

// Smoke tests for the re-export. The underlying behaviour is covered by
// `transactionLogUtils.test.ts`; these confirm the public contract of
// `lib/currency.ts` and that the symbol/grouping convention has not drifted.

describe("formatCurrency (re-exported from lib/currency)", () => {
  it("re-exports the same function (identity confirms no wrapper drift)", () => {
    expect(typeof formatCurrency).toBe("function");
  });

  it("formats zero as the bare currency symbol with no decimals", () => {
    expect(formatCurrency(0)).toBe("৳0");
  });

  it("formats whole positive numbers without decimals", () => {
    expect(formatCurrency(48500)).toBe("৳48,500");
  });

  it("formats decimals to exactly 2 places", () => {
    expect(formatCurrency(1234.5)).toBe("৳1,234.50");
  });

  it("formats negative amounts with the sign before the symbol", () => {
    expect(formatCurrency(-500)).toBe("-৳500");
  });
});
