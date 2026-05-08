import { describe, expect, it } from "vitest";
import {
  computeGrandTotal,
  computeNewFeeStatus,
  filterAssignableStructures,
  generateBillingPeriods,
  generateInvoiceNumber,
  generateTransactionReference,
  getAvailableMonths,
  getSequentialRemovalIds,
  resolveFutureMonths,
  validateSequentialMonths,
} from "./feeCollectionUtils";

describe("computeNewFeeStatus", () => {
  it("returns 'paid' when payment covers full balance", () => {
    expect(computeNewFeeStatus(5000, 0, 5000)).toBe("paid");
  });

  it("returns 'paid' when payment exceeds balance", () => {
    expect(computeNewFeeStatus(3000, 2000, 3000)).toBe("paid");
  });

  it("returns 'partial' when payment is less than balance", () => {
    expect(computeNewFeeStatus(5000, 0, 3000)).toBe("partial");
  });

  it("returns 'partial' when there was prior paid amount and balance remains", () => {
    expect(computeNewFeeStatus(3000, 2000, 1000)).toBe("partial");
  });

  it("returns 'unpaid' when payment is zero and no prior paid amount", () => {
    expect(computeNewFeeStatus(5000, 0, 0)).toBe("unpaid");
  });
});

describe("computeGrandTotal", () => {
  it("sums all balances", () => {
    expect(computeGrandTotal([1000, 2000, 3000])).toBe(6000);
  });

  it("returns 0 for empty array", () => {
    expect(computeGrandTotal([])).toBe(0);
  });

  it("handles single fee", () => {
    expect(computeGrandTotal([4500])).toBe(4500);
  });

  it("handles decimal amounts", () => {
    expect(computeGrandTotal([100.5, 200.5])).toBeCloseTo(301);
  });
});

describe("generateInvoiceNumber", () => {
  it("produces INV- prefixed string", () => {
    const ts = 1714742400000;
    expect(generateInvoiceNumber(ts)).toBe("INV-1714742400000");
  });

  it("uses exact timestamp value", () => {
    expect(generateInvoiceNumber(12345)).toBe("INV-12345");
  });
});

describe("generateTransactionReference", () => {
  it("produces TXN-{ts}-{index} format", () => {
    expect(generateTransactionReference(1000, 0)).toBe("TXN-1000-0");
    expect(generateTransactionReference(1000, 3)).toBe("TXN-1000-3");
  });
});

describe("getSequentialRemovalIds", () => {
  const fees = [
    { id: "fee-1", billingPeriod: "2025-01", feeStructureId: "fs-1" },
    { id: "fee-2", billingPeriod: "2025-02", feeStructureId: "fs-1" },
    { id: "fee-3", billingPeriod: "2025-03", feeStructureId: "fs-1" },
    { id: "fee-4", billingPeriod: "2025-04", feeStructureId: "fs-1" },
    { id: "fee-5", billingPeriod: "2025-02", feeStructureId: "fs-2" },
  ];

  it("removes target and all subsequent months for same fee structure", () => {
    const result = getSequentialRemovalIds("fee-2", fees);
    expect(result).toEqual(expect.arrayContaining(["fee-2", "fee-3", "fee-4"]));
    expect(result).toHaveLength(3);
  });

  it("does not remove fees from a different fee structure", () => {
    const result = getSequentialRemovalIds("fee-2", fees);
    expect(result).not.toContain("fee-5");
  });

  it("does not remove earlier months", () => {
    const result = getSequentialRemovalIds("fee-3", fees);
    expect(result).toEqual(expect.arrayContaining(["fee-3", "fee-4"]));
    expect(result).not.toContain("fee-1");
    expect(result).not.toContain("fee-2");
  });

  it("returns only the fee itself when no billingPeriod", () => {
    const feesNoPeriod = [
      { id: "fee-a", feeStructureId: "fs-1" },
      { id: "fee-b", billingPeriod: "2025-02", feeStructureId: "fs-1" },
    ];
    expect(getSequentialRemovalIds("fee-a", feesNoPeriod)).toEqual(["fee-a"]);
  });

  it("returns only the last month when removing the last one", () => {
    const result = getSequentialRemovalIds("fee-4", fees);
    expect(result).toEqual(["fee-4"]);
  });
});

describe("validateSequentialMonths", () => {
  it("returns true for consecutive months", () => {
    expect(validateSequentialMonths(["2025-01", "2025-02"], ["2025-03"])).toBe(
      true,
    );
  });

  it("returns true for empty new periods", () => {
    expect(validateSequentialMonths(["2025-01"], [])).toBe(true);
  });

  it("returns true for single period", () => {
    expect(validateSequentialMonths([], ["2025-06"])).toBe(true);
  });

  it("returns false when there is a gap", () => {
    expect(validateSequentialMonths(["2025-01"], ["2025-03"])).toBe(false);
  });

  it("handles year boundary (Dec to Jan)", () => {
    expect(validateSequentialMonths(["2024-12"], ["2025-01"])).toBe(true);
  });

  it("detects gap across year boundary", () => {
    expect(validateSequentialMonths(["2024-11"], ["2025-01"])).toBe(false);
  });
});

describe("resolveFutureMonths", () => {
  const allMonths = [
    "2025-01",
    "2025-02",
    "2025-03",
    "2025-04",
    "2025-05",
    "2025-06",
  ];

  it("filters out existing periods", () => {
    const existing = new Set(["2025-03", "2025-04"]);
    const result = resolveFutureMonths(allMonths, existing, "2025-03");
    expect(result).toEqual(["2025-05", "2025-06"]);
  });

  it("filters out months before current period", () => {
    const result = resolveFutureMonths(allMonths, new Set(), "2025-04");
    expect(result).toEqual(["2025-04", "2025-05", "2025-06"]);
  });

  it("returns empty array when all months are existing", () => {
    const existing = new Set(allMonths);
    const result = resolveFutureMonths(allMonths, existing, "2025-01");
    expect(result).toEqual([]);
  });

  it("includes current month if not existing", () => {
    const result = resolveFutureMonths(allMonths, new Set(), "2025-01");
    expect(result[0]).toBe("2025-01");
  });
});

describe("generateBillingPeriods", () => {
  it("generates monthly periods between start and end dates", () => {
    const start = new Date(2025, 0, 1); // Jan 2025
    const end = new Date(2025, 5, 30); // Jun 2025
    const periods = generateBillingPeriods(start, end);
    expect(periods).toEqual([
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
    ]);
  });

  it("handles single month range", () => {
    const start = new Date(2025, 3, 1); // Apr 2025
    const end = new Date(2025, 3, 30); // Apr 2025
    expect(generateBillingPeriods(start, end)).toEqual(["2025-04"]);
  });

  it("handles cross-year range", () => {
    const start = new Date(2024, 10, 1); // Nov 2024
    const end = new Date(2025, 1, 28); // Feb 2025
    expect(generateBillingPeriods(start, end)).toEqual([
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
    ]);
  });

  it("returns empty for end before start", () => {
    const start = new Date(2025, 5, 1);
    const end = new Date(2025, 3, 30);
    expect(generateBillingPeriods(start, end)).toEqual([]);
  });
});

// Sep 2024 = 2024-09-01T00:00:00Z
const SEP_2024 = new Date(2024, 8, 1).getTime();
// Jun 2025 = 2025-06-30T00:00:00Z
const JUN_2025 = new Date(2025, 5, 30).getTime();
// Nov 2024
const NOV_2024 = new Date(2024, 10, 1).getTime();
// Feb 2025
const FEB_2025 = new Date(2025, 1, 28).getTime();
// Apr 2025 (single-month)
const APR_2025_START = new Date(2025, 3, 1).getTime();
const APR_2025_END = new Date(2025, 3, 30).getTime();

describe("getAvailableMonths", () => {
  it("returns all months when no periods are already assigned (full year)", () => {
    const result = getAvailableMonths(SEP_2024, JUN_2025, []);
    expect(result).toEqual([
      "2024-09",
      "2024-10",
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
    ]);
  });

  it("excludes already-assigned periods", () => {
    const result = getAvailableMonths(SEP_2024, JUN_2025, [
      "2024-09",
      "2024-10",
    ]);
    expect(result).toEqual([
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
    ]);
  });

  it("returns empty array when all periods are already assigned", () => {
    const all = [
      "2024-09",
      "2024-10",
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
    ];
    expect(getAvailableMonths(SEP_2024, JUN_2025, all)).toEqual([]);
  });

  it("returns the single month when academic year is one month and not assigned", () => {
    expect(getAvailableMonths(APR_2025_START, APR_2025_END, [])).toEqual([
      "2025-04",
    ]);
  });

  it("returns empty when single-month academic year is already assigned", () => {
    expect(
      getAvailableMonths(APR_2025_START, APR_2025_END, ["2025-04"]),
    ).toEqual([]);
  });

  it("handles year-boundary ranges correctly", () => {
    const result = getAvailableMonths(NOV_2024, FEB_2025, []);
    expect(result).toEqual(["2024-11", "2024-12", "2025-01", "2025-02"]);
  });

  it("excludes assigned periods within a year-boundary range", () => {
    const result = getAvailableMonths(NOV_2024, FEB_2025, [
      "2024-12",
      "2025-01",
    ]);
    expect(result).toEqual(["2024-11", "2025-02"]);
  });
});

describe("filterAssignableStructures", () => {
  const oneTime = { _id: "fs-1", frequency: "one-time" as const };
  const yearly = { _id: "fs-2", frequency: "yearly" as const };
  const monthly = { _id: "fs-3", frequency: "monthly" as const };
  const monthly2 = { _id: "fs-4", frequency: "monthly" as const };

  it("returns all structures when no fees exist", () => {
    const result = filterAssignableStructures([oneTime, yearly, monthly], []);
    expect(result).toHaveLength(3);
  });

  it("excludes one-time structures already assigned", () => {
    const result = filterAssignableStructures(
      [oneTime, yearly, monthly],
      [{ feeStructureId: "fs-1" }],
    );
    expect(result.map((s) => s._id)).not.toContain("fs-1");
    expect(result.map((s) => s._id)).toContain("fs-2");
    expect(result.map((s) => s._id)).toContain("fs-3");
  });

  it("excludes yearly structures already assigned", () => {
    const result = filterAssignableStructures(
      [oneTime, yearly, monthly],
      [{ feeStructureId: "fs-2" }],
    );
    expect(result.map((s) => s._id)).not.toContain("fs-2");
    expect(result.map((s) => s._id)).toContain("fs-1");
    expect(result.map((s) => s._id)).toContain("fs-3");
  });

  it("always includes monthly structures even when months are assigned", () => {
    const result = filterAssignableStructures(
      [oneTime, monthly, monthly2],
      [{ feeStructureId: "fs-3" }, { feeStructureId: "fs-3" }],
    );
    expect(result.map((s) => s._id)).toContain("fs-3");
    expect(result.map((s) => s._id)).toContain("fs-4");
  });

  it("excludes both one-time and yearly when both are assigned", () => {
    const result = filterAssignableStructures(
      [oneTime, yearly, monthly],
      [{ feeStructureId: "fs-1" }, { feeStructureId: "fs-2" }],
    );
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("fs-3");
  });

  it("ignores existing fees referencing structures not in the input list", () => {
    const result = filterAssignableStructures(
      [oneTime, monthly],
      [{ feeStructureId: "fs-999" }],
    );
    expect(result).toHaveLength(2);
  });
});
