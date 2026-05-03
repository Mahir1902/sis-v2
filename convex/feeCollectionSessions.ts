import { v } from "convex/values";
import {
  computeNewFeeStatus,
  generateBillingPeriods,
  generateInvoiceNumber,
  generateTransactionReference,
  resolveFutureMonths,
} from "../lib/feeCollectionUtils";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";

const paymentModeValidator = v.union(
  v.literal("Cash"),
  v.literal("Bank Transfer"),
  v.literal("Cheque"),
  v.literal("UPI"),
  v.literal("Online"),
);

/**
 * Atomic multi-fee collection mutation.
 * Creates one session (future invoice), one transaction per fee, and updates
 * each studentFee record. All-or-nothing within a single Convex transaction.
 */
export const collectFees = mutation({
  args: {
    studentId: v.id("students"),
    feeIds: v.array(v.id("studentFees")),
    paymentMode: paymentModeValidator,
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    if (args.feeIds.length === 0) {
      throw new Error("No fees selected for collection");
    }

    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    if (student.status !== "active") {
      throw new Error("Cannot collect fees for a non-active student");
    }

    const fees = await Promise.all(
      args.feeIds.map(async (feeId) => {
        const fee = await ctx.db.get(feeId);
        if (!fee) throw new Error("Fee record not found");
        if (fee.studentId !== args.studentId) {
          throw new Error("Fee does not belong to this student");
        }
        if (fee.status === "paid") {
          throw new Error("Fee has already been paid");
        }
        if (fee.balance <= 0) {
          throw new Error("Fee has no outstanding balance");
        }
        return fee;
      }),
    );

    const now = Date.now();
    const totalAmount = fees.reduce((sum, fee) => sum + fee.balance, 0);
    const invoiceNumber = generateInvoiceNumber(now);

    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_student_academic_year", (q) =>
        q
          .eq("studentId", args.studentId)
          .eq("academicYear", student.academicYear),
      )
      .first();

    const sessionId = await ctx.db.insert("feeCollectionSessions", {
      invoiceNumber,
      studentId: args.studentId,
      academicYear: student.academicYear,
      campus: enrollment?.campus,
      totalAmount,
      paymentMode: args.paymentMode,
      remarks: args.remarks,
      status: "completed",
      collectedBy: user._id,
      transactionDate: now,
      feeCount: fees.length,
    });

    const transactions: Array<{
      txnId: string;
      referenceNumber: string;
      feeId: string;
    }> = [];

    for (let i = 0; i < fees.length; i++) {
      const fee = fees[i];
      const referenceNumber = generateTransactionReference(now, i);
      const amount = fee.balance;

      const txnId = await ctx.db.insert("feeTransactions", {
        studentId: args.studentId,
        feeId: fee._id,
        academicYear: fee.academicYear,
        amount,
        paymentMode: args.paymentMode,
        transactionDate: now,
        referenceNumber,
        sessionId,
        collectedBy: user._id,
        remarks: args.remarks,
      });

      const newPaidAmount = fee.paidAmount + amount;
      const newBalance = fee.balance - amount;
      const newStatus = computeNewFeeStatus(
        fee.balance,
        fee.paidAmount,
        amount,
      );

      await ctx.db.patch(fee._id, {
        paidAmount: newPaidAmount,
        balance: newBalance,
        status: newStatus,
        paymentDetails: [
          ...fee.paymentDetails,
          {
            paymentId: txnId,
            date: new Date(now).toISOString(),
            amount,
            mode: args.paymentMode,
          },
        ],
      });

      transactions.push({
        txnId: txnId as string,
        referenceNumber,
        feeId: fee._id as string,
      });
    }

    await logAudit(ctx, {
      user,
      action: "collect_fees",
      entityType: "feeCollectionSessions",
      entityId: sessionId,
      description: `Collected ${fees.length} fee(s) totaling ${totalAmount}`,
      metadata: {
        invoiceNumber,
        feeCount: fees.length,
        totalAmount,
        paymentMode: args.paymentMode,
      },
    });

    return { sessionId, invoiceNumber, totalAmount, transactions };
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

      const feeId = await ctx.db.insert("studentFees", {
        studentId: args.studentId,
        feeStructureId: args.feeStructureId,
        academicYear: args.academicYear,
        dueDate: Date.now(),
        originalAmount: feeStructure.baseAmount,
        paidAmount: 0,
        balance: feeStructure.baseAmount,
        status: "unpaid",
        billingPeriod: period,
        appliedDiscounts: [],
        paymentDetails: [],
      });

      createdFeeIds.push(feeId as string);

      await logAudit(ctx, {
        user,
        action: "create",
        entityType: "studentFees",
        entityId: feeId,
        description: `Created future month fee for ${period}`,
        metadata: { billingPeriod: period, amount: feeStructure.baseAmount },
      });
    }

    return createdFeeIds;
  },
});
