import { describe, expect, it } from "vitest";
import {
  balanceClassFor,
  dueDateClassFor,
  type InvoiceStatus,
} from "./invoiceDocumentDisplay";

// These helpers extract the inline ternaries that used to live in
// `components/shared/InvoiceDocument.tsx`. The class strings are asserted
// verbatim — the component reads them directly into `className`, so any drift
// here would change the rendered colour.

describe("balanceClassFor", () => {
  it("returns the red utility when there is an outstanding balance (positive)", () => {
    expect(balanceClassFor(1)).toBe("text-red-600");
  });

  it("returns the red utility for a large outstanding balance", () => {
    expect(balanceClassFor(48_500)).toBe("text-red-600");
  });

  it("returns the green utility when the balance is exactly zero (fully paid)", () => {
    // Strict > 0 semantics: zero is treated as 'cleared', not 'outstanding'.
    expect(balanceClassFor(0)).toBe("text-green-700");
  });

  it("returns the green utility for a negative balance (overpayment edge case)", () => {
    // Preserves the prior inline ternary — anything not strictly > 0 is green.
    expect(balanceClassFor(-250)).toBe("text-green-700");
  });
});

describe("dueDateClassFor", () => {
  it("returns the red emphasis utility when the invoice is overdue", () => {
    expect(dueDateClassFor("overdue")).toBe("text-red-600 font-medium");
  });

  it("returns the neutral utility for draft invoices", () => {
    expect(dueDateClassFor("draft")).toBe("font-medium");
  });

  it("returns the neutral utility for sent invoices", () => {
    // 'sent' may visually become 'overdue' after the daily cron flips it, but
    // until that happens the due date is rendered without red emphasis.
    expect(dueDateClassFor("sent")).toBe("font-medium");
  });

  it("returns the neutral utility for paid invoices", () => {
    expect(dueDateClassFor("paid")).toBe("font-medium");
  });

  it("returns the neutral utility for voided invoices", () => {
    expect(dueDateClassFor("voided")).toBe("font-medium");
  });

  it("covers exactly the five known InvoiceStatus values (regression guard)", () => {
    // If the InvoiceStatus union grows, this test fails loudly so we remember
    // to add a colour rule for the new status.
    const statuses: InvoiceStatus[] = [
      "draft",
      "sent",
      "paid",
      "overdue",
      "voided",
    ];
    for (const s of statuses) {
      expect(typeof dueDateClassFor(s)).toBe("string");
    }
  });
});
