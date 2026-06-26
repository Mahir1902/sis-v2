import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

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
