/**
 * Pure business logic for fee collection.
 * Extracted from the Convex mutation so it can be unit-tested without a database.
 */

export type FeeStatus = "paid" | "partial" | "unpaid";

export function computeNewFeeStatus(
  currentBalance: number,
  currentPaidAmount: number,
  paymentAmount: number,
): FeeStatus {
  const newBalance = currentBalance - paymentAmount;
  const newPaidAmount = currentPaidAmount + paymentAmount;
  if (newBalance <= 0) return "paid";
  if (newPaidAmount > 0) return "partial";
  return "unpaid";
}

export function computeGrandTotal(balances: number[]): number {
  return balances.reduce((sum, b) => sum + b, 0);
}

export function generateInvoiceNumber(timestamp: number): string {
  return `INV-${timestamp}`;
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
 * Validates that billing periods maintain sequential ordering.
 * Returns true if adding the periods would be valid (no gaps).
 */
export function validateSequentialMonths(
  existingPeriods: string[],
  newPeriods: string[],
): boolean {
  const all = [...existingPeriods, ...newPeriods].sort();
  for (let i = 1; i < all.length; i++) {
    const [prevYear, prevMonth] = all[i - 1].split("-").map(Number);
    const [currYear, currMonth] = all[i].split("-").map(Number);
    const prevTotal = prevYear * 12 + prevMonth;
    const currTotal = currYear * 12 + currMonth;
    if (currTotal - prevTotal > 1) return false;
  }
  return true;
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

type FeeStructureMinimal = {
  _id: string;
  frequency: "one-time" | "monthly" | "yearly";
};
type ExistingFeeMinimal = { feeStructureId: string };

/**
 * Filters active fee structures to those still assignable to a student.
 * Monthly structures are always included.
 * One-time and yearly structures are excluded when already assigned
 * (i.e., when an existing studentFee references the same feeStructureId).
 */
export function filterAssignableStructures(
  structures: FeeStructureMinimal[],
  existingFees: ExistingFeeMinimal[],
): FeeStructureMinimal[] {
  const structureMap = new Map(structures.map((s) => [s._id, s]));
  const assignedNonMonthly = new Set<string>();

  for (const fee of existingFees) {
    const structure = structureMap.get(fee.feeStructureId);
    if (structure && structure.frequency !== "monthly") {
      assignedNonMonthly.add(fee.feeStructureId);
    }
  }

  return structures.filter((s) => {
    if (s.frequency === "monthly") return true;
    return !assignedNonMonthly.has(s._id);
  });
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
