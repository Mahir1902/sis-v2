/// <reference types="vite/client" />

import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

/**
 * Architecture review candidate 8: the transaction log used to `.take(500)`
 * BEFORE filtering, so a year with more than 500 sessions undercounted every
 * total. These tests seed 700 sessions in one year and check that the totals,
 * the row count and the export are exact.
 */

const modules = import.meta.glob("./**/*.*s");

type TC = TestConvex<typeof schema>;

const DAY = 86400000;
const YEAR_START = Date.UTC(2025, 0, 1);

let asAdmin: TC;
let adminId: Id<"users">;
let yearId: Id<"academicYears">;
let campusA: Id<"campuses">;
let campusB: Id<"campuses">;
let studentA: Id<"students">;

// 700 sessions: day i (0..699), amount i+1, alternating campus, every third
// is Online, every 7th is voided, every 10th belongs to studentA.
const SESSIONS = 700;
const seeded = Array.from({ length: SESSIONS }, (_, i) => ({
  day: i,
  amount: i + 1,
  campus: i % 2 === 0 ? "A" : "B",
  mode: i % 3 === 0 ? "Online" : "Cash",
  voided: i % 7 === 0,
  studentA: i % 10 === 0,
}));

const expected = (pred: (s: (typeof seeded)[number]) => boolean) => {
  const rows = seeded.filter(pred);
  return {
    count: rows.length,
    total: rows.reduce((sum, r) => sum + r.amount, 0),
  };
};

beforeEach(async () => {
  const t = convexTest(schema, modules);

  adminId = await t.run(async (ctx) => {
    return ctx.db.insert("users", {
      name: "Admin",
      email: "admin@school.edu",
      role: "admin",
      isActive: true,
    });
  });
  asAdmin = t.withIdentity({ subject: `${adminId}|session` }) as TC;

  await t.run(async (ctx) => {
    yearId = await ctx.db.insert("academicYears", {
      name: "2025-2026",
      startDate: YEAR_START,
      endDate: YEAR_START + 365 * DAY,
    });
    const otherYear = await ctx.db.insert("academicYears", {
      name: "2024-2025",
      startDate: YEAR_START - 365 * DAY,
      endDate: YEAR_START,
    });
    campusA = await ctx.db.insert("campuses", {
      name: "Campus A",
      address: "A St",
    });
    campusB = await ctx.db.insert("campuses", {
      name: "Campus B",
      address: "B St",
    });
    studentA = await ctx.db.insert("students", {
      studentNumber: "S-A",
      studentFullName: "Alice Anderson",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const studentB = await ctx.db.insert("students", {
      studentNumber: "S-B",
      studentFullName: "Bob Brown",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    // One shared fee so every session can carry one line item for the export.
    const levelId = await ctx.db.insert("standardLevels", {
      name: "Grade 1",
      code: "01",
    });
    const structureId = await ctx.db.insert("feeStructure", {
      name: "Tuition",
      baseAmount: 1,
      frequency: "monthly",
      feeType: "tuition",
      standardLevel: levelId,
      isActive: true,
    });
    const feeId = await ctx.db.insert("studentFees", {
      studentId: studentB,
      feeStructureId: structureId,
      academicYear: yearId,
      dueDate: YEAR_START,
      originalAmount: 1,
      paidAmount: 0,
      balance: 1,
      status: "unpaid",
      appliedDiscounts: [],
      paymentDetails: [],
    });

    for (const s of seeded) {
      const studentId = s.studentA ? studentA : studentB;
      const sessionId = await ctx.db.insert("feeCollectionSessions", {
        studentId,
        academicYear: yearId,
        campus: s.campus === "A" ? campusA : campusB,
        totalAmount: s.amount,
        paymentMode: s.mode as "Online" | "Cash",
        status: s.voided ? "voided" : "completed",
        collectedBy: adminId,
        transactionDate: YEAR_START + s.day * DAY,
        feeCount: 1,
      });
      await ctx.db.insert("feeTransactions", {
        studentId,
        feeId,
        academicYear: yearId,
        amount: s.amount,
        paymentMode: s.mode as "Online" | "Cash",
        transactionDate: YEAR_START + s.day * DAY,
        sessionId,
      });
    }
    // Noise in another year: must never be counted.
    await ctx.db.insert("feeCollectionSessions", {
      studentId: studentB,
      academicYear: otherYear,
      totalAmount: 1_000_000,
      paymentMode: "Cash",
      status: "completed",
      collectedBy: adminId,
      transactionDate: YEAR_START - DAY,
      feeCount: 1,
    });
  });
});

type LogPage = FunctionReturnType<typeof api.transactionLog.getTransactionLog>;

async function allRows(args: Record<string, unknown>) {
  const rows: LogPage["page"] = [];
  let cursor: string | null = null;
  for (;;) {
    const res: LogPage = await asAdmin.query(
      api.transactionLog.getTransactionLog,
      {
        academicYearId: yearId,
        ...args,
        paginationOpts: { numItems: 150, cursor },
      },
    );
    rows.push(...res.page);
    if (res.isDone) return rows;
    cursor = res.continueCursor;
  }
}

describe("transaction log past 500 sessions in a year", () => {
  it("totals every completed session in the year, not the first 500", async () => {
    const want = expected((s) => !s.voided);
    const { aggregates } = await asAdmin.query(
      api.transactionLog.getTransactionLogTotals,
      { academicYearId: yearId },
    );
    expect(aggregates.sessionCount).toBe(want.count);
    expect(aggregates.totalAmount).toBe(want.total);
    expect(want.count).toBeGreaterThan(500);

    const rows = await allRows({});
    expect(rows).toHaveLength(want.count);
    expect(rows.every((r) => r.status === "completed")).toBe(true);
  });

  it("applies date, campus, mode and voided filters over the whole range", async () => {
    const from = YEAR_START + 100 * DAY;
    const to = YEAR_START + 650 * DAY;
    const pred = (s: (typeof seeded)[number]) =>
      s.day >= 100 && s.day <= 650 && s.campus === "B" && s.mode === "Cash";
    const want = expected(pred);
    const wantWithVoided = expected((s) => pred(s));
    const wantCompleted = expected((s) => pred(s) && !s.voided);

    const args = {
      dateFrom: from,
      dateTo: to,
      campusFilter: campusB,
      paymentMode: "Cash" as const,
    };

    const completed = await asAdmin.query(
      api.transactionLog.getTransactionLogTotals,
      { academicYearId: yearId, ...args },
    );
    expect(completed.aggregates.sessionCount).toBe(wantCompleted.count);
    expect(completed.aggregates.totalAmount).toBe(wantCompleted.total);
    expect(completed.aggregates.byCampus).toEqual({
      "Campus B": wantCompleted.total,
    });
    expect(completed.aggregates.byPaymentMode).toEqual({
      Cash: wantCompleted.total,
    });

    const withVoided = await asAdmin.query(
      api.transactionLog.getTransactionLogTotals,
      { academicYearId: yearId, ...args, includeVoided: true },
    );
    expect(withVoided.aggregates.sessionCount).toBe(wantWithVoided.count);
    expect(withVoided.aggregates.totalAmount).toBe(want.total);

    const rows = await allRows({ ...args, includeVoided: true });
    expect(rows).toHaveLength(wantWithVoided.count);
    // Newest first, and the end-of-day `dateTo` includes day 650 itself.
    expect(rows[0].transactionDate).toBeLessThanOrEqual(to + DAY - 1);
    expect(rows.at(-1)?.transactionDate).toBeGreaterThanOrEqual(from);
  });

  it("filters by student across the whole year", async () => {
    const want = expected((s) => s.studentA && !s.voided);
    const { aggregates } = await asAdmin.query(
      api.transactionLog.getTransactionLogTotals,
      { academicYearId: yearId, studentIds: [studentA] },
    );
    expect(aggregates.sessionCount).toBe(want.count);
    const rows = await allRows({ studentIds: [studentA] });
    expect(rows).toHaveLength(want.count);
    expect(rows.every((r) => r.studentNumber === "S-A")).toBe(true);
  });

  it("exports one line per completed session across the whole year", async () => {
    const want = expected((s) => !s.voided);
    const { rows } = await asAdmin.query(
      api.transactionLog.getTransactionLogExport,
      { academicYearId: yearId },
    );
    expect(rows).toHaveLength(want.count);
    expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBe(want.total);
    expect(rows[0].feeName).toBe("Tuition");
  });

  it("refuses an export past the cap instead of truncating it", async () => {
    await asAdmin.run(async (ctx) => {
      for (let i = 0; i < 1401; i++) {
        await ctx.db.insert("feeCollectionSessions", {
          studentId: studentA,
          academicYear: yearId,
          totalAmount: 1,
          paymentMode: "Cash",
          status: "completed",
          collectedBy: adminId,
          transactionDate: YEAR_START + i,
          feeCount: 1,
        });
      }
    });
    await expect(
      asAdmin.query(api.transactionLog.getTransactionLogExport, {
        academicYearId: yearId,
      }),
    ).rejects.toThrow(ConvexError);
    // A narrower range still exports.
    const { rows } = await asAdmin.query(
      api.transactionLog.getTransactionLogExport,
      { academicYearId: yearId, dateFrom: YEAR_START + 600 * DAY },
    );
    expect(rows).toHaveLength(expected((s) => !s.voided && s.day >= 600).count);
  });

  it("finds students through the search index", async () => {
    const hits = await asAdmin.query(api.transactionLog.searchStudents, {
      nameQuery: "ali",
    });
    expect(hits.map((h) => h.studentNumber)).toEqual(["S-A"]);
    expect(
      await asAdmin.query(api.transactionLog.searchStudents, {
        nameQuery: "   ",
      }),
    ).toEqual([]);
  });
});
