import { describe, expect, it } from "vitest";
import {
  computeInvoiceAggregates,
  isInvoiceOverdue,
  matchesInvoiceSearch,
} from "./invoiceAggregates";

// A fixed "now" used by the overdue / aggregate tests. Choosing 2025-06-01T12:00Z
// gives us a stable anchor against which dueDate values are clearly past or future.
const NOW = new Date("2025-06-01T12:00:00Z").getTime();
const ONE_DAY_MS = 86_400_000;
const PAST = NOW - 7 * ONE_DAY_MS;
const FUTURE = NOW + 7 * ONE_DAY_MS;

type InvoiceFixture = {
  totalAmount: number;
  paidAmount: number;
  status: "draft" | "issued" | "paid" | "overdue" | "voided";
  dueDate: number;
};

describe("computeInvoiceAggregates", () => {
  it("returns all zeros for empty input", () => {
    expect(computeInvoiceAggregates([], NOW)).toEqual({
      totalInvoiced: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      totalOverdue: 0,
    });
  });

  it("sums totalInvoiced over all non-voided invoices regardless of status", () => {
    const invoices: InvoiceFixture[] = [
      { totalAmount: 1000, paidAmount: 0, status: "draft", dueDate: FUTURE },
      { totalAmount: 500, paidAmount: 200, status: "issued", dueDate: FUTURE },
      { totalAmount: 750, paidAmount: 750, status: "paid", dueDate: PAST },
    ];
    const result = computeInvoiceAggregates(invoices, NOW);
    expect(result.totalInvoiced).toBe(2250);
  });

  it("sums totalCollected over all non-voided invoices", () => {
    const invoices: InvoiceFixture[] = [
      { totalAmount: 1000, paidAmount: 100, status: "issued", dueDate: FUTURE },
      { totalAmount: 500, paidAmount: 500, status: "paid", dueDate: PAST },
      { totalAmount: 200, paidAmount: 0, status: "draft", dueDate: FUTURE },
    ];
    const result = computeInvoiceAggregates(invoices, NOW);
    expect(result.totalCollected).toBe(600);
  });

  it("computes totalOutstanding as sum of (totalAmount - paidAmount) for invoices with positive balance", () => {
    const invoices: InvoiceFixture[] = [
      { totalAmount: 1000, paidAmount: 200, status: "issued", dueDate: FUTURE }, // 800
      { totalAmount: 500, paidAmount: 500, status: "paid", dueDate: PAST }, // 0
      { totalAmount: 300, paidAmount: 0, status: "draft", dueDate: FUTURE }, // 300
    ];
    const result = computeInvoiceAggregates(invoices, NOW);
    expect(result.totalOutstanding).toBe(1100);
  });

  it("treats stored 'overdue' status as overdue", () => {
    const invoices: InvoiceFixture[] = [
      { totalAmount: 1000, paidAmount: 200, status: "overdue", dueDate: PAST },
    ];
    const result = computeInvoiceAggregates(invoices, NOW);
    expect(result.totalOverdue).toBe(800);
  });

  it("treats 'issued' invoices whose dueDate has passed as overdue (dynamic detection)", () => {
    const invoices: InvoiceFixture[] = [
      { totalAmount: 1000, paidAmount: 100, status: "issued", dueDate: PAST }, // overdue: 900
      { totalAmount: 500, paidAmount: 0, status: "issued", dueDate: FUTURE }, // not yet
    ];
    const result = computeInvoiceAggregates(invoices, NOW);
    expect(result.totalOverdue).toBe(900);
  });

  it("does NOT treat draft or paid invoices as overdue, even when past due", () => {
    const invoices: InvoiceFixture[] = [
      { totalAmount: 1000, paidAmount: 0, status: "draft", dueDate: PAST },
      { totalAmount: 500, paidAmount: 500, status: "paid", dueDate: PAST },
    ];
    const result = computeInvoiceAggregates(invoices, NOW);
    expect(result.totalOverdue).toBe(0);
  });

  it("excludes voided invoices from every aggregate", () => {
    const invoices: InvoiceFixture[] = [
      { totalAmount: 1000, paidAmount: 250, status: "voided", dueDate: PAST },
      { totalAmount: 500, paidAmount: 500, status: "voided", dueDate: FUTURE },
    ];
    expect(computeInvoiceAggregates(invoices, NOW)).toEqual({
      totalInvoiced: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      totalOverdue: 0,
    });
  });

  it("excludes voided invoices but includes the rest in a mixed set", () => {
    const invoices: InvoiceFixture[] = [
      { totalAmount: 1000, paidAmount: 0, status: "issued", dueDate: PAST }, // overdue 1000
      { totalAmount: 500, paidAmount: 500, status: "paid", dueDate: PAST },
      { totalAmount: 300, paidAmount: 0, status: "draft", dueDate: FUTURE },
      { totalAmount: 9999, paidAmount: 0, status: "voided", dueDate: PAST }, // excluded
    ];
    const result = computeInvoiceAggregates(invoices, NOW);
    expect(result.totalInvoiced).toBe(1800);
    expect(result.totalCollected).toBe(500);
    expect(result.totalOutstanding).toBe(1300); // 1000 + 300
    expect(result.totalOverdue).toBe(1000);
  });

  it("rounds aggregate values to 2 decimal places", () => {
    const invoices: InvoiceFixture[] = [
      {
        totalAmount: 100.123,
        paidAmount: 10.456,
        status: "issued",
        dueDate: PAST,
      },
      { totalAmount: 50.789, paidAmount: 0, status: "draft", dueDate: FUTURE },
    ];
    const result = computeInvoiceAggregates(invoices, NOW);
    // totalInvoiced = 100.123 + 50.789 = 150.912 → 150.91
    expect(result.totalInvoiced).toBe(150.91);
    // totalCollected = 10.456 → 10.46
    expect(result.totalCollected).toBe(10.46);
    // totalOutstanding = (100.123 - 10.456) + (50.789 - 0) = 89.667 + 50.789 = 140.456 → 140.46
    expect(result.totalOutstanding).toBe(140.46);
    // totalOverdue = (100.123 - 10.456) = 89.667 → 89.67
    expect(result.totalOverdue).toBe(89.67);
  });

  it("does not double-count an invoice that is both overdue-by-status and past-due-by-date", () => {
    const invoices: InvoiceFixture[] = [
      { totalAmount: 1000, paidAmount: 0, status: "overdue", dueDate: PAST },
    ];
    const result = computeInvoiceAggregates(invoices, NOW);
    expect(result.totalOverdue).toBe(1000);
  });

  it("excludes invoices with zero balance from totalOutstanding (no negative contribution)", () => {
    const invoices: InvoiceFixture[] = [
      { totalAmount: 500, paidAmount: 700, status: "paid", dueDate: PAST }, // overpaid
    ];
    const result = computeInvoiceAggregates(invoices, NOW);
    expect(result.totalOutstanding).toBe(0);
  });

  it("handles an issued invoice whose dueDate equals now as NOT overdue (strict <)", () => {
    const invoices: InvoiceFixture[] = [
      { totalAmount: 100, paidAmount: 0, status: "issued", dueDate: NOW },
    ];
    const result = computeInvoiceAggregates(invoices, NOW);
    expect(result.totalOverdue).toBe(0);
  });
});

describe("matchesInvoiceSearch", () => {
  const inv = {
    invoiceNumber: "INV-2024-001",
    studentName: "Aisha Khan",
    studentNumber: "S-2024-042",
  };

  it("returns true for an empty search term", () => {
    expect(matchesInvoiceSearch(inv, "")).toBe(true);
  });

  it("returns true for a whitespace-only search term", () => {
    expect(matchesInvoiceSearch(inv, "   ")).toBe(true);
    expect(matchesInvoiceSearch(inv, "\t\n")).toBe(true);
  });

  it("matches invoiceNumber case-insensitively", () => {
    expect(matchesInvoiceSearch(inv, "inv-2024-001")).toBe(true);
    expect(matchesInvoiceSearch(inv, "INV-2024-001")).toBe(true);
    expect(matchesInvoiceSearch(inv, "2024-001")).toBe(true);
  });

  it("matches studentName case-insensitively", () => {
    expect(matchesInvoiceSearch(inv, "aisha")).toBe(true);
    expect(matchesInvoiceSearch(inv, "KHAN")).toBe(true);
    expect(matchesInvoiceSearch(inv, "Aisha Khan")).toBe(true);
  });

  it("matches studentNumber case-insensitively", () => {
    expect(matchesInvoiceSearch(inv, "S-2024-042")).toBe(true);
    expect(matchesInvoiceSearch(inv, "s-2024")).toBe(true);
    expect(matchesInvoiceSearch(inv, "042")).toBe(true);
  });

  it("returns false when the term matches none of the fields", () => {
    expect(matchesInvoiceSearch(inv, "Mohammed")).toBe(false);
    expect(matchesInvoiceSearch(inv, "INV-2025-999")).toBe(false);
    expect(matchesInvoiceSearch(inv, "xyz")).toBe(false);
  });

  it("ignores leading/trailing whitespace in the search term", () => {
    expect(matchesInvoiceSearch(inv, "  aisha  ")).toBe(true);
    expect(matchesInvoiceSearch(inv, "\tINV-2024-001\n")).toBe(true);
  });
});

describe("isInvoiceOverdue", () => {
  it("returns true when status is 'issued' AND dueDate is strictly before now", () => {
    expect(isInvoiceOverdue({ status: "issued", dueDate: PAST }, NOW)).toBe(
      true,
    );
  });

  it("returns false when status is 'issued' and dueDate is in the future", () => {
    expect(isInvoiceOverdue({ status: "issued", dueDate: FUTURE }, NOW)).toBe(
      false,
    );
  });

  it("returns false when status is 'issued' and dueDate equals now (strict <)", () => {
    expect(isInvoiceOverdue({ status: "issued", dueDate: NOW }, NOW)).toBe(
      false,
    );
  });

  it("returns false when status is 'paid' regardless of dueDate", () => {
    expect(isInvoiceOverdue({ status: "paid", dueDate: PAST }, NOW)).toBe(
      false,
    );
  });

  it("returns false when status is 'draft' regardless of dueDate", () => {
    expect(isInvoiceOverdue({ status: "draft", dueDate: PAST }, NOW)).toBe(
      false,
    );
  });

  it("returns false when status is 'overdue' (it is stored-overdue, not issued-becoming-overdue)", () => {
    expect(isInvoiceOverdue({ status: "overdue", dueDate: PAST }, NOW)).toBe(
      false,
    );
  });

  it("returns false when status is 'voided' regardless of dueDate", () => {
    expect(isInvoiceOverdue({ status: "voided", dueDate: PAST }, NOW)).toBe(
      false,
    );
  });

  it("returns false for any unknown status string", () => {
    expect(isInvoiceOverdue({ status: "garbage", dueDate: PAST }, NOW)).toBe(
      false,
    );
  });
});
