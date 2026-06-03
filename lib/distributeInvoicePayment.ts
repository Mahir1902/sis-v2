/**
 * Distributes a single payment amount across the line items of an invoice.
 *
 * Algorithm:
 *   1. Skip fees with zero or negative outstanding balance.
 *   2. Walk the remaining fees in input order, fully applying the payment to
 *      each until exhausted (the last touched fee may receive a partial amount).
 *   3. Reject payments larger than the total outstanding balance — the caller
 *      should not silently produce phantom credit. Refunds belong elsewhere.
 *
 * Pure — no DB access, no side effects. The Convex `recordInvoicePayment`
 * mutation calls this to compute how to update each studentFee row, then
 * inserts one `feeTransactions` row per allocation returned here.
 */

export interface DistributeArgs {
  paymentAmount: number;
  fees: Array<{ studentFeeId: string; balance: number }>;
}

export interface Allocation {
  studentFeeId: string;
  appliedAmount: number;
}

export function distributeInvoicePayment(args: DistributeArgs): Allocation[] {
  if (args.paymentAmount <= 0) {
    throw new Error("Payment amount must be positive");
  }

  const eligible = args.fees.filter((f) => f.balance > 0);
  if (eligible.length === 0) {
    throw new Error("Invoice has no outstanding fees to pay");
  }

  const totalOutstanding = eligible.reduce((sum, f) => sum + f.balance, 0);
  if (args.paymentAmount > totalOutstanding) {
    throw new Error("Payment amount exceeds invoice balance");
  }

  let remaining = args.paymentAmount;
  const out: Allocation[] = [];
  for (const fee of eligible) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, fee.balance);
    out.push({ studentFeeId: fee.studentFeeId, appliedAmount: applied });
    remaining -= applied;
  }
  return out;
}
