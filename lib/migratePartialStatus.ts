/**
 * Pure decision helper for the Issue #36 migration that narrows
 * `studentFees.status` from `("unpaid","partial","paid")` to `("unpaid","paid")`.
 *
 * Rule (per HANDOFF_issue_36.md "Open landmines"):
 *   flip to `paid` if paidAmount >= originalAmount - sum(appliedDiscounts.amount)
 *   else flip to `unpaid`.
 *
 * Do NOT coalesce or invent a third bucket — this is a deliberate domain
 * narrowing per ADR-0002's receipt-first model.
 */

type AppliedDiscount = {
  discountId: unknown;
  type: string;
  amount: number;
};

export type ResolvePartialStatusInput = {
  paidAmount: number;
  originalAmount: number;
  appliedDiscounts: AppliedDiscount[];
};

export function resolvePartialStatus(
  fee: ResolvePartialStatusInput,
): "paid" | "unpaid" {
  const totalDiscount = fee.appliedDiscounts.reduce(
    (sum, d) => sum + d.amount,
    0,
  );
  const netDue = fee.originalAmount - totalDiscount;
  return fee.paidAmount >= netDue ? "paid" : "unpaid";
}
