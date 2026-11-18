import { v } from "convex/values";
import {
  generateBillingPeriods,
  resolveFutureMonths,
} from "../lib/feeCollectionUtils";
import { mutation, query } from "./_generated/server";
import { assignFee, collect } from "./lib/feeLedger";
import { requireRole } from "./lib/permissions";

const paymentModeValidator = v.union(
  v.literal("Cash"),
  v.literal("Bank Transfer"),
  v.literal("Cheque"),
  v.literal("UPI"),
  v.literal("Online"),
);

/**
 * Records a payment for an active student: one session, one transaction per
 * fee, every fee → paid, one numbered Receipt. All-or-nothing. The money
 * logic lives in `lib/feeLedger.collect`; this wrapper only authorises and
 * applies the "active student" rule (re-issue of a leaver's receipt bypasses
 * it on purpose).
 */
export const collectFees = mutation({
  args: {
    studentId: v.id("students"),
    feeIds: v.array(v.id("studentFees")),
    paymentMode: paymentModeValidator,
    remarks: v.optional(v.string()),
    expectedTotal: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    if (student.status !== "active") {
      throw new Error("Cannot collect fees for a non-active student");
    }
    return await collect(ctx, user, args);
  },
});

/** Get all collection sessions for a student. */
export const getByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db
      .query("feeCollectionSessions")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .order("desc")
      .take(100);
  },
});

/**
 * Resolves available future months for advance payment of a recurring fee.
 * Returns months within the current academic year that don't yet have a
 * studentFee record (or have an unpaid one).
 */
export const getFutureMonths = query({
  args: {
    studentId: v.id("students"),
    feeStructureId: v.id("feeStructure"),
    academicYear: v.id("academicYears"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const feeStructure = await ctx.db.get(args.feeStructureId);
    if (!feeStructure || feeStructure.frequency !== "monthly") {
      return [];
    }

    const academicYear = await ctx.db.get(args.academicYear);
    if (!academicYear) return [];

    const allMonths = generateBillingPeriods(
      new Date(academicYear.startDate),
      new Date(academicYear.endDate),
    );

    const existingFees = await ctx.db
      .query("studentFees")
      .withIndex("by_student_year", (q) =>
        q.eq("studentId", args.studentId).eq("academicYear", args.academicYear),
      )
      .take(200);

    const existingPeriods = new Set(
      existingFees
        .filter(
          (f) => f.feeStructureId === args.feeStructureId && f.billingPeriod,
        )
        .map((f) => f.billingPeriod as string),
    );

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    return resolveFutureMonths(allMonths, existingPeriods, currentPeriod).map(
      (m) => ({
        billingPeriod: m,
        amount: feeStructure.baseAmount,
      }),
    );
  },
});

/**
 * Creates future-month studentFee records for advance payment of recurring fees.
 * Called before collectFees to materialize fee records for months being pre-paid.
 */
export const createFutureMonthFees = mutation({
  args: {
    studentId: v.id("students"),
    feeStructureId: v.id("feeStructure"),
    academicYear: v.id("academicYears"),
    billingPeriods: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    if (args.billingPeriods.length === 0) return [];

    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    if (student.status !== "active") {
      throw new Error("Cannot create fees for a non-active student");
    }

    const feeStructure = await ctx.db.get(args.feeStructureId);
    if (!feeStructure) throw new Error("Fee structure not found");
    if (feeStructure.frequency !== "monthly") {
      throw new Error("Future months only apply to monthly fees");
    }

    const existingFees = await ctx.db
      .query("studentFees")
      .withIndex("by_student_year", (q) =>
        q.eq("studentId", args.studentId).eq("academicYear", args.academicYear),
      )
      .take(200);

    const existingPeriods = new Set(
      existingFees
        .filter(
          (f) => f.feeStructureId === args.feeStructureId && f.billingPeriod,
        )
        .map((f) => f.billingPeriod as string),
    );

    const createdFeeIds: string[] = [];

    for (const period of args.billingPeriods) {
      if (existingPeriods.has(period)) {
        const existing = existingFees.find(
          (f) =>
            f.feeStructureId === args.feeStructureId &&
            f.billingPeriod === period,
        );
        if (existing) {
          createdFeeIds.push(existing._id as string);
          continue;
        }
      }

      const feeId = await assignFee(ctx, user, {
        studentId: args.studentId,
        feeStructureId: args.feeStructureId,
        academicYear: args.academicYear,
        dueDate: Date.now(),
        billingPeriod: period,
        description: `Created future month fee for ${period}`,
      });

      createdFeeIds.push(feeId as string);
    }

    return createdFeeIds;
  },
});
