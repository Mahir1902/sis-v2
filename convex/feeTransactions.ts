import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireCapability } from "./lib/permissions";

/** Get all fee transactions for a student. */
export const getByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "manageStudentFees");
    const txns = await ctx.db
      .query("feeTransactions")
      .withIndex("by_student_year", (q) => q.eq("studentId", args.studentId))
      .take(500);
    return txns.sort((a, b) => b.transactionDate - a.transactionDate);
  },
});

/** Get transactions for a specific fee record. Rows with `voidedAt` are history, not live payments. */
export const getByFee = query({
  args: { feeId: v.id("studentFees") },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "manageStudentFees");
    return await ctx.db
      .query("feeTransactions")
      .withIndex("by_fee", (q) => q.eq("feeId", args.feeId))
      .take(100);
  },
});
