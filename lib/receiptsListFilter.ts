import type { Doc, Id } from "../convex/_generated/dataModel";

/**
 * Subset of a Receipt row exposed by `listReceipts` to the admin list page.
 * Deliberately excludes the full `lineItems` array — the list table renders
 * one row per Receipt and only needs identity + filterable columns.
 *
 * `supersedes` and `supersededBy` are included so the list can badge
 * correction chains without a per-row second query (PRD #34, slice 6).
 */
export type ReceiptListRow = {
  _id: Id<"receipts">;
  receiptNumber: string;
  studentId: Id<"students">;
  studentNameSnapshot: string;
  studentNumberSnapshot: string;
  payerName: string;
  status: Doc<"receipts">["status"];
  paymentMethod: Doc<"receipts">["paymentMethod"];
  paymentDate: number;
  totalAmount: number;
  supersedes: Id<"receipts"> | undefined;
  supersededBy: Id<"receipts"> | undefined;
};

export type ReceiptsListFilter = {
  dateRange?: { from: number; to: number };
  studentId?: Id<"students">;
  status?: Doc<"receipts">["status"];
};

/**
 * Pure, deterministic filter + sort applied to receipts already fetched via
 * the most-selective Convex index. Lives outside the query handler so it can
 * be unit-tested without the Convex test harness.
 *
 * Sorted by `paymentDate` descending — most-recently-collected first.
 */
export function applyReceiptsListFilter(
  rows: readonly ReceiptListRow[],
  filter: ReceiptsListFilter,
): ReceiptListRow[] {
  const { dateRange, studentId, status } = filter;
  return rows
    .filter((row) => {
      if (dateRange) {
        if (row.paymentDate < dateRange.from) return false;
        if (row.paymentDate > dateRange.to) return false;
      }
      if (studentId && row.studentId !== studentId) return false;
      if (status && row.status !== status) return false;
      return true;
    })
    .slice()
    .sort((a, b) => b.paymentDate - a.paymentDate);
}
