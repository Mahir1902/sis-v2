/**
 * Pure business logic for fee collection.
 * Extracted from the Convex mutation so it can be unit-tested without a database.
 */

export type FeeStatus = "paid" | "unpaid";

/**
 * Determines the post-payment status. With Issue #36's narrowing
 * (ADR-0002 receipt-first model), partial payments are no longer modelled
 * as their own status: any payment that does not fully cover the balance
 * is rejected upstream by `collectFees`, so reaching this function with a
 * non-zero leftover balance is a logic bug.
 */
export function computeNewFeeStatus(
  currentBalance: number,
  payment: number,
): FeeStatus {
  if (payment >= currentBalance) return "paid";
  throw new Error(
    "Partial payments are not supported; collect the full outstanding balance.",
  );
}

export function generateTransactionReference(
  timestamp: number,
  index: number,
): string {
  return `TXN-${timestamp}-${index}`;
}

/**
 * Enforces sequential month ordering for removal.
 * When a billing period is removed, all subsequent periods for the same
 * fee structure must also be removed.
 *
 * Returns the set of fee IDs that should be removed.
 */
export function getSequentialRemovalIds(
  removedFeeId: string,
  fees: Array<{
    id: string;
    billingPeriod?: string;
    feeStructureId: string;
  }>,
): string[] {
  const removedFee = fees.find((f) => f.id === removedFeeId);
  if (!removedFee?.billingPeriod) return [removedFeeId];

  const removedPeriod = removedFee.billingPeriod;
  return fees
    .filter(
      (f) =>
        f.billingPeriod &&
        f.feeStructureId === removedFee.feeStructureId &&
        f.billingPeriod >= removedPeriod,
    )
    .map((f) => f.id);
}

/**
 * Resolves available future months from a list of all months in the academic year,
 * filtering out months already assigned and months before the current period.
 */
export function resolveFutureMonths(
  allMonths: string[],
  existingPeriods: Set<string>,
  currentPeriod: string,
): string[] {
  return allMonths.filter((m) => m >= currentPeriod && !existingPeriods.has(m));
}

/**
 * Returns YYYY-MM billing period strings within the academic year range that
 * are not already in existingBillingPeriods.
 */
export function getAvailableMonths(
  startDate: number,
  endDate: number,
  existingBillingPeriods: string[],
): string[] {
  const allMonths = generateBillingPeriods(
    new Date(startDate),
    new Date(endDate),
  );
  const existing = new Set(existingBillingPeriods);
  return allMonths.filter((m) => !existing.has(m));
}

/**
 * Generates all YYYY-MM billing periods between two dates.
 */
export function generateBillingPeriods(
  startDate: Date,
  endDate: Date,
): string[] {
  const periods: string[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cursor <= endDate) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    periods.push(`${yyyy}-${mm}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return periods;
}
