import {
  computeNewFeeStatus,
  generateTransactionReference,
} from "../../lib/feeCollectionUtils";
import { currentBdYear, formatReceiptNumber } from "../../lib/receiptNumber";
import {
  buildReceiptSnapshot,
  type ReceiptSnapshotPaidLine,
} from "../../lib/receiptSnapshot";
import { resolveBillingContact } from "../../lib/resolveBillingContact";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { logAudit } from "../auditLogs";
import { getCurrentPlacement } from "./placement";

/**
 * Fee ledger — the ONLY module that writes money.
 *
 * Every write to `studentFees` money fields (`paidAmount`, `balance`,
 * `status`, `appliedDiscounts`), `feeCollectionSessions`, `feeTransactions`,
 * `receipts` and `receiptCounters` goes through one of the five functions
 * here. Public mutations in `studentFees.ts`, `feeCollectionSessions.ts`,
 * `receipts.ts` and `promotions.ts` are thin wrappers that do `requireRole`
 * and call in with the resulting `actor`.
 *
 * Invariants (ADR-0002, ADR-0003, CONTEXT.md "Fee Billing"):
 * - `status: "paid"` is written only by `collect`, so a paid fee always has a
 *   live transaction, a session and a receipt behind it.
 * - A discount changes `balance` only. A fully discounted fee is settled by a
 *   normal ৳0 collect, which issues a ৳0 receipt documenting the waiver.
 * - Payment is all-or-nothing; a session and its receipt are 1:1.
 * - Void is whole-receipt: receipt + session → `voided`, every covered fee →
 *   `unpaid`, transactions stay as history stamped with `voidedAt`.
 * - Re-issue = void + collect in one transaction, cross-linked.
 */

export type Actor = Pick<Doc<"users">, "_id" | "email" | "name">;
export type PaymentMode = Doc<"feeCollectionSessions">["paymentMode"];

/** Hard cap on fees per collection — keeps one mutation inside Convex write limits. */
const MAX_FEES_PER_COLLECTION = 100;
/** Upper bound on transactions walked for one session (sessions hold ≤ 100). */
const SESSION_TXN_LIMIT = 200;

const sumDiscounts = (fee: Doc<"studentFees">) =>
  fee.appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);

// ─── assign ──────────────────────────────────────────────────────────────────

/**
 * Creates one unpaid `studentFees` row — the single insert shape. The amount
 * always comes from the fee structure, never from the client.
 */
export async function assignFee(
  ctx: MutationCtx,
  actor: Actor,
  args: {
    studentId: Id<"students">;
    feeStructureId: Id<"feeStructure">;
    academicYear: Id<"academicYears">;
    dueDate?: number;
    billingPeriod?: string;
    description?: string;
  },
): Promise<Id<"studentFees">> {
  const structure = await ctx.db.get(args.feeStructureId);
  if (!structure) throw new Error("Fee structure not found");

  const amount = structure.baseAmount;
  const id = await ctx.db.insert("studentFees", {
    studentId: args.studentId,
    feeStructureId: args.feeStructureId,
    academicYear: args.academicYear,
    dueDate: args.dueDate ?? structure.dueDate ?? Date.now(),
    originalAmount: amount,
    paidAmount: 0,
    balance: amount,
    status: "unpaid",
    billingPeriod: args.billingPeriod,
    appliedDiscounts: [],
  });

  await logAudit(ctx, {
    user: actor,
    action: "create",
    entityType: "studentFees",
    entityId: id,
    description: args.description ?? "Assigned fee to student",
    metadata: { billingPeriod: args.billingPeriod, amount },
  });
  return id;
}

// ─── discount ────────────────────────────────────────────────────────────────

/**
 * Applies a discount rule to an unpaid fee. Reduces `balance` and appends to
 * `appliedDiscounts`; never touches `status` — a fee that reaches balance 0
 * still needs a (৳0) collect to be settled and receipted.
 */
export async function applyDiscount(
  ctx: MutationCtx,
  actor: Actor,
  args: { feeId: Id<"studentFees">; discountRuleId: Id<"discountRules"> },
): Promise<{ discountAmount: number; balance: number }> {
  const [rule, fee] = await Promise.all([
    ctx.db.get(args.discountRuleId),
    ctx.db.get(args.feeId),
  ]);
  if (!rule) throw new Error("Discount rule not found");
  if (!rule.isActive) throw new Error("Discount rule is inactive");
  if (!fee) throw new Error("Fee record not found");
  if (fee.status === "paid") {
    throw new Error("Cannot discount a paid fee. Void its receipt first.");
  }

  let discountAmount =
    rule.discountType === "percentage"
      ? (fee.originalAmount * rule.amount) / 100
      : rule.amount;
  if (rule.discountType === "percentage" && rule.maxDiscountAmount) {
    discountAmount = Math.min(discountAmount, rule.maxDiscountAmount);
  }
  discountAmount = Math.min(discountAmount, fee.balance);
  if (discountAmount <= 0) {
    throw new Error("This fee has no balance left to discount");
  }

  const appliedDiscounts = [
    ...fee.appliedDiscounts,
    {
      discountId: args.discountRuleId,
      amount: discountAmount,
      type: rule.discountType,
    },
  ];
  const balance = fee.balance - discountAmount;
  await ctx.db.patch(fee._id, { balance, appliedDiscounts });

  await logAudit(ctx, {
    user: actor,
    action: "apply_discount",
    entityType: "studentFees",
    entityId: fee._id,
    description: `Applied discount "${rule.name}" (${discountAmount})`,
    metadata: {
      discountRuleId: args.discountRuleId,
      discountAmount,
      balance,
      studentId: fee.studentId,
    },
  });
  return { discountAmount, balance };
}

// ─── collect ─────────────────────────────────────────────────────────────────

/**
 * Allocates the next Receipt number for the current Bangladesh calendar year.
 * Read-then-write on the one counter row; Convex serialises overlapping
 * writers via OCC so numbers are never duplicated.
 */
async function allocateReceiptNumber(
  ctx: MutationCtx,
  nowMs: number,
): Promise<string> {
  const year = currentBdYear(nowMs);
  const counter = await ctx.db
    .query("receiptCounters")
    .withIndex("by_year", (q) => q.eq("year", year))
    .first();
  let sequence: number;
  if (counter) {
    sequence = counter.nextNumber;
    await ctx.db.patch(counter._id, { nextNumber: sequence + 1 });
  } else {
    sequence = 1;
    await ctx.db.insert("receiptCounters", { year, nextNumber: 2 });
  }
  return formatReceiptNumber(year, sequence);
}

export interface CollectArgs {
  studentId: Id<"students">;
  feeIds: Id<"studentFees">[];
  paymentMode: PaymentMode;
  remarks?: string;
  /** Total the admin saw; the collect fails if the server total differs. */
  expectedTotal?: number;
  /** Payment date for session + receipt. Defaults to now. */
  paymentDate?: number;
  /** Where to file the session. Defaults to the student's Current Placement. */
  placement?: {
    academicYear: Id<"academicYears">;
    campus?: Id<"campuses">;
    standardLevelId?: Id<"standardLevels">;
  };
  /** Set only by `voidAndReissue`: the voided receipt this one replaces. */
  supersedes?: Id<"receipts">;
}

export interface CollectResult {
  sessionId: Id<"feeCollectionSessions">;
  receiptId: Id<"receipts">;
  receiptNumber: string;
  totalAmount: number;
  transactions: Array<{
    txnId: string;
    referenceNumber: string;
    feeId: string;
  }>;
}

/**
 * Records one payment: one session, one transaction per fee, every fee →
 * `paid`, one numbered Receipt with the full snapshot. All-or-nothing.
 */
export async function collect(
  ctx: MutationCtx,
  actor: Actor,
  args: CollectArgs,
): Promise<CollectResult> {
  if (args.feeIds.length === 0) {
    throw new Error("No fees selected for collection");
  }
  if (args.feeIds.length > MAX_FEES_PER_COLLECTION) {
    throw new Error(
      `Collect at most ${MAX_FEES_PER_COLLECTION} fees in one receipt`,
    );
  }
  if (new Set(args.feeIds).size !== args.feeIds.length) {
    throw new Error("The same fee was selected more than once");
  }

  const student = await ctx.db.get(args.studentId);
  if (!student) throw new Error("Student not found");

  // A receipt is a legal document whose payer and student names are frozen
  // at issue time (ADR-0002). Refuse to issue rather than snapshot a stand-in.
  const studentFullName = student.studentFullName;
  const primaryBillingContact = student.primaryBillingContact;
  if (!studentFullName) {
    throw new Error(
      "This student has no recorded name. Complete the student record before collecting fees.",
    );
  }
  if (!primaryBillingContact) {
    throw new Error(
      "This student has no billing contact set. Set one before collecting fees.",
    );
  }
  const billing = resolveBillingContact({ ...student, primaryBillingContact });
  if (!billing.name) {
    throw new Error(
      "The billing contact for this student has no recorded name. Complete the student record before collecting fees.",
    );
  }

  const fees = await Promise.all(
    args.feeIds.map(async (feeId) => {
      const fee = await ctx.db.get(feeId);
      if (!fee) throw new Error("Fee record not found");
      if (fee.studentId !== args.studentId) {
        throw new Error("Fee does not belong to this student");
      }
      if (fee.status === "paid") throw new Error("Fee has already been paid");
      if (fee.balance < 0) throw new Error("Fee has a negative balance");
      return fee;
    }),
  );

  const feeStructures = await Promise.all(
    fees.map((fee) => ctx.db.get(fee.feeStructureId)),
  );
  const feeStructureMap = new Map<string, { name: string }>();
  for (let i = 0; i < fees.length; i++) {
    const fs = feeStructures[i];
    if (!fs) throw new Error("Fee structure not found");
    feeStructureMap.set(fees[i].feeStructureId as string, { name: fs.name });
  }

  const totalAmount = fees.reduce((sum, fee) => sum + fee.balance, 0);
  // Tolerant compare: percentage discounts give non-integer balances and the
  // client may sum them in a different order.
  if (
    args.expectedTotal !== undefined &&
    Math.abs(args.expectedTotal - totalAmount) > 0.005
  ) {
    throw new Error("Amounts changed since you opened this. Review and retry.");
  }

  const now = Date.now();
  if (
    args.paymentDate !== undefined &&
    (!Number.isFinite(args.paymentDate) ||
      args.paymentDate <= 0 ||
      args.paymentDate > now + 86_400_000)
  ) {
    throw new Error("Invalid payment date");
  }
  const paymentDate = args.paymentDate ?? now;
  const placement =
    args.placement ?? (await getCurrentPlacement(ctx, args.studentId));

  const sessionId = await ctx.db.insert("feeCollectionSessions", {
    studentId: args.studentId,
    academicYear: placement?.academicYear ?? fees[0].academicYear,
    campus: placement?.campus,
    totalAmount,
    paymentMode: args.paymentMode,
    remarks: args.remarks,
    status: "completed",
    collectedBy: actor._id,
    transactionDate: paymentDate,
    feeCount: fees.length,
    standardLevelId: placement?.standardLevelId,
  });

  const transactions: CollectResult["transactions"] = [];
  for (let i = 0; i < fees.length; i++) {
    const fee = fees[i];
    const amount = fee.balance;
    const referenceNumber = generateTransactionReference(now, i);
    const txnId = await ctx.db.insert("feeTransactions", {
      studentId: args.studentId,
      feeId: fee._id,
      academicYear: fee.academicYear,
      amount,
      paymentMode: args.paymentMode,
      transactionDate: paymentDate,
      referenceNumber,
      sessionId,
      collectedBy: actor._id,
      remarks: args.remarks,
    });
    await ctx.db.patch(fee._id, {
      paidAmount: fee.paidAmount + amount,
      balance: 0,
      status: computeNewFeeStatus(fee.balance, amount),
    });
    transactions.push({
      txnId: txnId as string,
      referenceNumber,
      feeId: fee._id as string,
    });
  }

  const paidLines: ReceiptSnapshotPaidLine[] = fees.map((fee) => ({
    feeStructureId: fee.feeStructureId as string,
    billingPeriod: fee.billingPeriod,
    originalAmount: fee.originalAmount,
    discountAmount: sumDiscounts(fee),
    paidAmount: fee.balance,
  }));
  const snapshot = buildReceiptSnapshot({
    student: { studentFullName, studentNumber: student.studentNumber },
    billingContact: { name: billing.name, contactType: billing.contactType },
    issuer: { name: actor.name },
    feeStructures: feeStructureMap,
    paidLines,
  });

  const receiptNumber = await allocateReceiptNumber(ctx, now);
  const receiptId = await ctx.db.insert("receipts", {
    studentId: args.studentId,
    sessionId,
    collectedBy: actor._id,
    receiptNumber,
    status: "issued",
    totalAmount,
    paymentMethod: args.paymentMode,
    paymentDate,
    issuedAt: now,
    payerName: snapshot.payerName,
    payerRole: snapshot.payerRole,
    studentNameSnapshot: snapshot.studentNameSnapshot,
    studentNumberSnapshot: snapshot.studentNumberSnapshot,
    issuerName: snapshot.issuerName,
    lineItems: snapshot.lineItems,
    remarks: args.remarks,
    supersedes: args.supersedes,
  });

  await logAudit(ctx, {
    user: actor,
    action: "collect_fees",
    entityType: "feeCollectionSessions",
    entityId: sessionId,
    description: `Collected ${fees.length} fee(s) totaling ${totalAmount}; issued ${receiptNumber}`,
    metadata: {
      feeCount: fees.length,
      totalAmount,
      paymentMode: args.paymentMode,
      receiptNumber,
      receiptId: receiptId as string,
      supersedes: args.supersedes,
    },
  });

  return { sessionId, receiptId, receiptNumber, totalAmount, transactions };
}

// ─── void ────────────────────────────────────────────────────────────────────

/**
 * Whole-receipt void (ADR-0003). Receipt and session → `voided`; each live
 * transaction is stamped `voidedAt` and its fee goes back to `unpaid` with
 * the balance recomputed from the originals (no float drift). A fee that no
 * longer exists is skipped and reported.
 */
interface VoidResult {
  receipt: Doc<"receipts">;
  session: Doc<"feeCollectionSessions">;
  restoredFeeIds: Id<"studentFees">[];
  skippedFeeIds: Id<"studentFees">[];
}

/** The void writes without the audit row — shared by void and re-issue. */
async function voidCore(
  ctx: MutationCtx,
  actor: Actor,
  args: { receiptId: Id<"receipts">; reason: string },
): Promise<VoidResult> {
  if (!args.reason.trim()) throw new Error("A reason is required to void");

  const receipt = await ctx.db.get(args.receiptId);
  if (!receipt) throw new Error("Receipt not found");
  if (receipt.status === "voided") {
    throw new Error("This receipt is already voided");
  }
  const session = await ctx.db.get(receipt.sessionId);
  if (!session) throw new Error("Collection session not found");
  if (session.status === "voided") {
    throw new Error("This collection is already voided");
  }

  const txns = await ctx.db
    .query("feeTransactions")
    .withIndex("by_session", (q) => q.eq("sessionId", session._id))
    .take(SESSION_TXN_LIMIT);
  if (txns.length !== session.feeCount) {
    throw new Error(
      "This collection's transactions do not reconcile; it cannot be voided automatically.",
    );
  }

  const now = Date.now();
  const restoredFeeIds: Id<"studentFees">[] = [];
  const skippedFeeIds: Id<"studentFees">[] = [];
  for (const txn of txns) {
    const fee = await ctx.db.get(txn.feeId);
    await ctx.db.patch(txn._id, { voidedAt: now });
    if (!fee) {
      skippedFeeIds.push(txn.feeId);
      continue;
    }
    const paidAmount = Math.max(0, fee.paidAmount - txn.amount);
    await ctx.db.patch(fee._id, {
      paidAmount,
      balance: fee.originalAmount - sumDiscounts(fee) - paidAmount,
      status: "unpaid",
    });
    restoredFeeIds.push(fee._id);
  }

  await ctx.db.patch(session._id, { status: "voided" });
  await ctx.db.patch(receipt._id, {
    status: "voided",
    voidedAt: now,
    voidedBy: actor._id,
  });

  return { receipt, session, restoredFeeIds, skippedFeeIds };
}

async function logVoid(
  ctx: MutationCtx,
  actor: Actor,
  voided: VoidResult,
  reason: string,
  supersededBy?: Id<"receipts">,
) {
  await logAudit(ctx, {
    user: actor,
    action: "void",
    entityType: "receipts",
    entityId: voided.receipt._id,
    description: `Voided receipt ${voided.receipt.receiptNumber}: ${reason}`,
    metadata: {
      reason,
      sessionId: voided.session._id,
      totalAmount: voided.receipt.totalAmount,
      restoredFeeIds: voided.restoredFeeIds,
      skippedFeeIds: voided.skippedFeeIds,
      supersededBy,
    },
  });
}

export async function voidReceipt(
  ctx: MutationCtx,
  actor: Actor,
  args: { receiptId: Id<"receipts">; reason: string },
): Promise<VoidResult> {
  const voided = await voidCore(ctx, actor, args);
  await logVoid(ctx, actor, voided, args.reason);
  return voided;
}

// ─── void and re-issue ───────────────────────────────────────────────────────

/**
 * Atomic financial correction (ADR-0003): voids the receipt, then collects
 * the same fees again with the corrected payment method / date / remarks,
 * filed under the original session's year and class. The two receipts are
 * cross-linked via `supersedes` / `supersededBy`.
 */
export async function voidAndReissue(
  ctx: MutationCtx,
  actor: Actor,
  args: {
    receiptId: Id<"receipts">;
    reason: string;
    paymentMode: PaymentMode;
    paymentDate?: number;
    remarks?: string;
  },
): Promise<CollectResult> {
  const voided = await voidCore(ctx, actor, {
    receiptId: args.receiptId,
    reason: args.reason,
  });
  if (voided.skippedFeeIds.length > 0) {
    throw new Error(
      "A fee on this receipt no longer exists, so it cannot be re-issued. Void it instead.",
    );
  }

  const result = await collect(ctx, actor, {
    studentId: voided.session.studentId,
    feeIds: voided.restoredFeeIds,
    paymentMode: args.paymentMode,
    paymentDate: args.paymentDate,
    remarks: args.remarks,
    placement: {
      academicYear: voided.session.academicYear,
      campus: voided.session.campus,
      standardLevelId: voided.session.standardLevelId,
    },
    supersedes: voided.receipt._id,
  });
  await ctx.db.patch(voided.receipt._id, { supersededBy: result.receiptId });
  await logVoid(ctx, actor, voided, args.reason, result.receiptId);
  return result;
}
