import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

/** Apply a discount to a student fee. */
export const applyDiscount = mutation({
  args: {
    studentId: v.id("students"),
    feeId: v.id("studentFees"),
    discountRuleId: v.id("discountRules"),
    academicYear: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const rule = await ctx.db.get(args.discountRuleId);
    if (!rule) throw new Error("Discount rule not found");
    if (!rule.isActive) throw new Error("Discount rule is inactive");

    const fee = await ctx.db.get(args.feeId);
    if (!fee) throw new Error("Fee record not found");

    // Calculate discount amount
    let discountAmount: number;
    if (rule.discountType === "percentage") {
      discountAmount = (fee.originalAmount * rule.amount) / 100;
      if (rule.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, rule.maxDiscountAmount);
      }
    } else {
      discountAmount = rule.amount;
    }
    discountAmount = Math.min(discountAmount, fee.balance);

    // Update fee balance
    const newBalance = fee.balance - discountAmount;
    const newStatus =
      newBalance <= 0 ? "paid" : fee.paidAmount > 0 ? "partial" : "unpaid";

    const updatedDiscounts = [
      ...(fee.appliedDiscounts ?? []),
      {
        discountId: args.discountRuleId,
        amount: discountAmount,
        type: rule.discountType,
      },
    ];

    await ctx.db.patch(args.feeId, {
      balance: newBalance,
      status: newStatus,
      appliedDiscounts: updatedDiscounts,
    });

    // Record in studentDiscounts
    const discountId = await ctx.db.insert("studentDiscounts", {
      studentId: args.studentId,
      discountRuleId: args.discountRuleId,
      academicYear: args.academicYear,
      reason: rule.description ?? rule.name,
      startDate: new Date().toISOString().slice(0, 10),
      status: "active",
    });

    return { discountId, discountAmount };
  },
});

/** Get all discounts applied to a student for a given year. */
export const getByStudentYear = query({
  args: { studentId: v.id("students"), academicYear: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const discounts = await ctx.db
      .query("studentDiscounts")
      .withIndex("by_student_year", (q) =>
        q.eq("studentId", args.studentId).eq("academicYear", args.academicYear),
      )
      .collect();
    return await Promise.all(
      discounts.map(async (d) => ({
        ...d,
        ruleDoc: await ctx.db.get(d.discountRuleId),
      })),
    );
  },
});
