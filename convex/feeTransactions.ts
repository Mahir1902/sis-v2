import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";

/** Create a fee transaction and update the student fee in one atomic mutation. */
export const createTransaction = mutation({
  args: {
    studentId: v.id("students"),
    feeId: v.id("studentFees"),
    academicYear: v.id("academicYears"),
    amount: v.float64(),
    paymentMode: v.union(
      v.literal("Cash"),
      v.literal("Bank Transfer"),
      v.literal("Cheque"),
      v.literal("UPI"),
      v.literal("Online"),
    ),
    transactionDate: v.float64(),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    const fee = await ctx.db.get(args.feeId);
    if (!fee) throw new Error("Fee record not found");
    if (args.amount <= 0)
      throw new Error("Payment amount must be greater than 0");
    if (args.amount > fee.balance)
      throw new Error("Payment amount exceeds outstanding balance");

    const referenceNumber = `TXN-${Date.now()}`;

    // Insert transaction
    const txnId = await ctx.db.insert("feeTransactions", {
      studentId: args.studentId,
      feeId: args.feeId,
      academicYear: args.academicYear,
      amount: args.amount,
      paymentMode: args.paymentMode,
      transactionDate: args.transactionDate,
      referenceNumber,
      remarks: args.remarks,
    });

    // Update student fee atomically
    const newPaidAmount = fee.paidAmount + args.amount;
    const newBalance = fee.balance - args.amount;
    const newStatus =
      newBalance <= 0 ? "paid" : newPaidAmount > 0 ? "partial" : "unpaid";

    const updatedPaymentDetails = [
      ...(fee.paymentDetails ?? []),
      {
        paymentId: txnId,
        date: new Date(args.transactionDate).toISOString(),
        amount: args.amount,
        mode: args.paymentMode,
      },
    ];

    await ctx.db.patch(args.feeId, {
      paidAmount: newPaidAmount,
      balance: newBalance,
      status: newStatus,
      paymentDetails: updatedPaymentDetails,
    });

    await logAudit(ctx, {
      user,
      action: "collect_payment",
      entityType: "feeTransactions",
      entityId: txnId,
      description: `Collected payment of ${args.amount}`,
      metadata: { amount: args.amount, paymentMode: args.paymentMode },
    });

    return { txnId, referenceNumber };
  },
});

/** Get all fee transactions for a student. */
export const getByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const txns = await ctx.db
      .query("feeTransactions")
      .withIndex("by_student_year", (q) => q.eq("studentId", args.studentId))
      .collect();
    return txns.sort((a, b) => b.transactionDate - a.transactionDate);
  },
});

/** Get transactions for a specific fee record. */
export const getByFee = query({
  args: { feeId: v.id("studentFees") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db
      .query("feeTransactions")
      .withIndex("by_fee", (q) => q.eq("feeId", args.feeId))
      .collect();
  },
});
