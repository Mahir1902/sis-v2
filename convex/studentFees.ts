import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import {
  assignFee,
  applyDiscount as ledgerApplyDiscount,
} from "./lib/feeLedger";
import { requireRole } from "./lib/permissions";

/**
 * Assigns one fee to a student (admission or mid-year). The amount comes from
 * the fee structure on the server; the client only names the structure.
 */
export const createStudentFee = mutation({
  args: {
    studentId: v.id("students"),
    feeStructureId: v.id("feeStructure"),
    academicYear: v.id("academicYears"),
    dueDate: v.optional(v.float64()),
    billingPeriod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    return await assignFee(ctx, user, args);
  },
});

/**
 * Applies a discount rule to an unpaid fee. The balance drops; the status
 * never changes here — a fully discounted fee is settled by a ৳0 collect.
 */
export const applyDiscount = mutation({
  args: {
    feeId: v.id("studentFees"),
    discountRuleId: v.id("discountRules"),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);
    return await ledgerApplyDiscount(ctx, user, args);
  },
});

/** Get all fees for a student. Admin, or the student's own linked account. */
export const getByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "student"]);
    if (user.role === "student" && user.studentId !== args.studentId) {
      throw new Error("Unauthorized");
    }
    const fees = await ctx.db
      .query("studentFees")
      .withIndex("by_student_year", (q) => q.eq("studentId", args.studentId))
      .order("desc")
      .take(100);

    return await Promise.all(
      fees.map(async (fee) => {
        const [structure, year, ...discountRules] = await Promise.all([
          ctx.db.get(fee.feeStructureId),
          ctx.db.get(fee.academicYear),
          ...fee.appliedDiscounts.map((d) => ctx.db.get(d.discountId)),
        ]);
        const enrichedDiscounts = fee.appliedDiscounts.map((d, i) => ({
          ...d,
          ruleName: discountRules[i]?.name ?? "Discount",
          ruleValue: discountRules[i]?.amount,
        }));
        return {
          ...fee,
          feeStructureDoc: structure,
          academicYearDoc: year,
          enrichedDiscounts,
        };
      }),
    );
  },
});

/** Get a single student fee by ID. */
export const getById = query({
  args: { feeId: v.id("studentFees") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db.get(args.feeId);
  },
});

/**
 * Delete an unpaid student fee record. Admin only; the fee must be unpaid
 * and have no live (un-voided) transaction. Voided transactions stay as
 * history and do not block the delete.
 */
export const deleteStudentFee = mutation({
  args: { feeId: v.id("studentFees") },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    const fee = await ctx.db.get(args.feeId);
    if (!fee) throw new Error("Fee record not found");
    if (fee.status === "paid" || fee.paidAmount > 0) {
      throw new Error("Cannot delete a paid fee. Void its receipt first.");
    }

    const txns = await ctx.db
      .query("feeTransactions")
      .withIndex("by_fee", (q) => q.eq("feeId", args.feeId))
      .take(100);
    if (txns.some((t) => t.voidedAt === undefined)) {
      throw new Error("Cannot delete a fee that has a live payment.");
    }

    await ctx.db.delete(args.feeId);

    await logAudit(ctx, {
      user,
      action: "delete",
      entityType: "studentFees",
      entityId: args.feeId,
      description: `Deleted unpaid fee record${fee.billingPeriod ? ` (${fee.billingPeriod})` : ""}`,
    });
  },
});
