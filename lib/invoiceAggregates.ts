/**
 * Pure aggregate / search / overdue utilities for the invoicing feature.
 *
 * These functions are deliberately framework-free so the same logic can power
 * the Convex `getInvoices` / `getInvoiceAggregates` queries AND be unit-tested
 * without a Convex context.
 *
 * Currency rule: all return values that represent money are rounded to 2dp
 * (banker-free, financial half-up). Callers should treat them as final and not
 * round again, to avoid drift.
 */

/** Internal: round a number to 2 decimal places using financial half-up. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The minimum shape required to compute aggregates over an invoice set. The
 * Convex query passes documents from the `invoices` table; tests pass simple
 * literals. Keeping the type narrow avoids importing Convex generated types
 * into a pure lib.
 */
export type InvoiceAggregateInput = {
  totalAmount: number;
  paidAmount: number;
  status: "draft" | "issued" | "paid" | "overdue" | "voided";
  dueDate: number;
};

/**
 * Aggregates an invoice set into the four summary numbers shown on the invoice
 * list page header.
 *
 * Rules:
 *   - Voided invoices are excluded from every aggregate.
 *   - `totalInvoiced` = sum of `totalAmount` for all non-voided invoices.
 *   - `totalCollected` = sum of `paidAmount` for all non-voided invoices.
 *   - `totalOutstanding` = sum of `max(0, totalAmount - paidAmount)` for all
 *     non-voided invoices (overpayments do not subtract from outstanding).
 *   - `totalOverdue` = sum of `max(0, totalAmount - paidAmount)` for non-voided
 *     invoices that are either stored as `overdue` OR currently `issued` AND
 *     past due (`dueDate < now`). Computed dynamically so the UI does not need
 *     to wait for the daily cron to flip statuses.
 *
 * All return values are rounded to 2 decimal places.
 */
export function computeInvoiceAggregates(
  invoices: ReadonlyArray<InvoiceAggregateInput>,
  now: number,
): {
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
} {
  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;

  for (const inv of invoices) {
    if (inv.status === "voided") continue;

    totalInvoiced += inv.totalAmount;
    totalCollected += inv.paidAmount;

    const balance = inv.totalAmount - inv.paidAmount;
    if (balance > 0) {
      totalOutstanding += balance;
    }

    // Overdue: stored status is overdue, OR issued + past due.
    const isOverdueByStatus = inv.status === "overdue";
    const isOverdueByIssuedPastDue =
      inv.status === "issued" && inv.dueDate < now;
    if ((isOverdueByStatus || isOverdueByIssuedPastDue) && balance > 0) {
      totalOverdue += balance;
    }
  }

  return {
    totalInvoiced: round2(totalInvoiced),
    totalCollected: round2(totalCollected),
    totalOutstanding: round2(totalOutstanding),
    totalOverdue: round2(totalOverdue),
  };
}

/**
 * Case-insensitive substring search against an invoice's number, student name,
 * or student admission number.
 *
 * An empty or whitespace-only term matches everything (the UI uses an empty
 * search box to mean "no filter"). Leading/trailing whitespace in the term is
 * trimmed before matching.
 */
export function matchesInvoiceSearch(
  invoice: {
    invoiceNumber: string;
    studentName: string;
    studentNumber: string;
  },
  term: string,
): boolean {
  const trimmed = term.trim();
  if (trimmed.length === 0) return true;
  const needle = trimmed.toLowerCase();
  return (
    invoice.invoiceNumber.toLowerCase().includes(needle) ||
    invoice.studentName.toLowerCase().includes(needle) ||
    invoice.studentNumber.toLowerCase().includes(needle)
  );
}

/**
 * True iff the invoice's stored status is `issued` AND its dueDate is strictly
 * before `now`. Used to dynamically detect invoices that the daily overdue cron
 * has not yet flipped.
 *
 * Note: an invoice whose stored status is already `overdue` returns false here
 * — `isInvoiceOverdue` answers the narrower question "should we treat this
 * issued invoice as overdue right now?". Callers that need the broader sense
 * (overdue by status OR by date) should check both explicitly.
 */
export function isInvoiceOverdue(
  invoice: { status: string; dueDate: number },
  now: number,
): boolean {
  return invoice.status === "issued" && invoice.dueDate < now;
}
