import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

/** Create a student fee record (called during admission). */
export const createStudentFee = mutation({
  args: {
    studentId: v.id("students"),
    feeStructureId: v.id("feeStructure"),
    academicYear: v.id("academicYears"),
    originalAmount: v.float64(),
    paidAmount: v.float64(),
    balance: v.float64(),
    status: v.union(
      v.literal("unpaid"),
      v.literal("partial"),
      v.literal("paid"),
    ),
    dueDate: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    return await ctx.db.insert("studentFees", {
      ...args,
      dueDate: args.dueDate ?? Date.now(),
      appliedDiscounts: [],
      paymentDetails: [],
    });
  },
});

/** Get all fees for a student. */
export const getByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher", "student"]);
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

/** Update a student fee after payment. */
export const updateStudentFee = mutation({
  args: {
    feeId: v.id("studentFees"),
    paidAmount: v.float64(),
    balance: v.float64(),
    status: v.union(
      v.literal("unpaid"),
      v.literal("partial"),
      v.literal("paid"),
    ),
    paymentDetails: v.array(
      v.object({
        paymentId: v.id("feeTransactions"),
        date: v.string(),
        amount: v.float64(),
        mode: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const { feeId, ...updates } = args;
    await ctx.db.patch(feeId, updates);
    return feeId;
  },
});
