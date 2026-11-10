/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

/**
 * Fee ledger invariants (convex/lib/feeLedger.ts, ADR-0002/0003, CONTEXT.md
 * "Fee Billing"): paid ⇔ live transaction + receipt; discounts never mark a
 * fee paid; void restores every covered fee; re-issue is one atomic,
 * cross-linked operation; receipt numbers are sequential; a student with
 * financial rows cannot be hard-deleted.
 */

const modules = import.meta.glob("./**/*.*s");
type TC = TestConvex<typeof schema>;

let t: TC;
let asAdmin: TC;
let asTeacher: TC;
let grade1: Id<"standardLevels">;
let year: Id<"academicYears">;
let campus: Id<"campuses">;
let tuition: Id<"feeStructure">;
let books: Id<"feeStructure">;
let fullDiscount: Id<"discountRules">;
let halfDiscount: Id<"discountRules">;

beforeEach(async () => {
  t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    grade1 = await ctx.db.insert("standardLevels", {
      name: "Grade 1",
      code: "01",
    });
    year = await ctx.db.insert("academicYears", {
      name: "2026-2027",
      startDate: 0,
      endDate: 1,
    });
    campus = await ctx.db.insert("campuses", {
      name: "Campus 01",
      address: "-",
    });
    tuition = await ctx.db.insert("feeStructure", {
      name: "Tuition",
      baseAmount: 1000,
      frequency: "monthly",
      feeType: "tuition",
      standardLevel: grade1,
      isActive: true,
    });
    books = await ctx.db.insert("feeStructure", {
      name: "Library",
      baseAmount: 333,
      frequency: "yearly",
      feeType: "library",
      standardLevel: grade1,
      isActive: true,
    });
    fullDiscount = await ctx.db.insert("discountRules", {
      name: "Scholarship",
      discountType: "percentage",
      amount: 100,
      isActive: true,
    });
    halfDiscount = await ctx.db.insert("discountRules", {
      name: "Sibling",
      discountType: "percentage",
      amount: 7.5,
      isActive: true,
    });
    const admin = await ctx.db.insert("users", {
      name: "Admin",
      email: "admin@school.edu",
      role: "admin",
      isActive: true,
    });
    const teacher = await ctx.db.insert("users", {
      name: "Teacher",
      email: "t@school.edu",
      role: "teacher",
      isActive: true,
    });
    return { admin, teacher };
  });
  asAdmin = t.withIdentity({ subject: `${ids.admin}|s` }) as TC;
  asTeacher = t.withIdentity({ subject: `${ids.teacher}|s` }) as TC;
});

function admit(studentNumber = "S0126-0001") {
  return asAdmin.mutation(api.students.createStudent, {
    studentNumber,
    studentFullName: "Amina Rahman",
    gender: "Female",
    dateOfBirth: 0,
    placeOfBirth: "Dhaka",
    citizenship: "BD",
    religion: "Islam",
    bloodGroup: "O+",
    birthCertificateNumber: "BC-1",
    standardLevel: grade1,
    academicYear: year,
    campus,
    classStartDate: 0,
    presentAddress: "Uttara",
    healthIssue: { hasHealthIssues: false },
    fatherName: "Father Rahman",
    fatherOccupation: "-",
    fatherNidNumber: "-",
    fatherPhoneNumber: "017",
    motherName: "M",
    motherOccupation: "-",
    motherNidNumber: "-",
    motherPhoneNumber: "018",
    guardianName: "G",
    guardianRelation: "-",
    guardianNidNumber: "-",
    guardianPhoneNumber: "019",
    familyAnnualIncome: "-",
    consultantName: "-",
  });
}

const assign = (
  studentId: Id<"students">,
  feeStructureId: Id<"feeStructure">,
  billingPeriod?: string,
) =>
  asAdmin.mutation(api.studentFees.createStudentFee, {
    studentId,
    feeStructureId,
    academicYear: year,
    billingPeriod,
  });

const collect = (studentId: Id<"students">, feeIds: Id<"studentFees">[]) =>
  asAdmin.mutation(api.feeCollectionSessions.collectFees, {
    studentId,
    feeIds,
    paymentMode: "Cash",
  });

const fee = (id: Id<"studentFees">) => t.run((ctx) => ctx.db.get(id));
const receipt = (id: Id<"receipts">) => t.run((ctx) => ctx.db.get(id));
const txnsOf = (feeId: Id<"studentFees">) =>
  t.run((ctx) =>
    ctx.db
      .query("feeTransactions")
      .withIndex("by_fee", (q) => q.eq("feeId", feeId))
      .collect(),
  );

describe("assign", () => {
  it("writes the single insert shape from the fee structure, never from the client", async () => {
    const s = await admit();
    const id = await assign(s, tuition, "2026-09");
    expect(await fee(id)).toMatchObject({
      originalAmount: 1000,
      paidAmount: 0,
      balance: 1000,
      status: "unpaid",
      billingPeriod: "2026-09",
      appliedDiscounts: [],
    });
  });
});

describe("collect → void → re-issue", () => {
  it("round-trips: paid with receipt, voided back to unpaid, re-issued and cross-linked", async () => {
    const s = await admit();
    const f1 = await assign(s, tuition, "2026-09");
    const f2 = await assign(s, books);

    const first = await collect(s, [f1, f2]);
    expect(first.receiptNumber).toMatch(/^RCP-\d{4}-00001$/);
    expect(first.totalAmount).toBe(1333);
    expect(await fee(f1)).toMatchObject({
      status: "paid",
      paidAmount: 1000,
      balance: 0,
    });
    expect(await fee(f2)).toMatchObject({
      status: "paid",
      paidAmount: 333,
      balance: 0,
    });
    expect((await receipt(first.receiptId))?.lineItems).toHaveLength(2);

    // Void: receipt + session voided, fees unpaid, transactions kept as history.
    await asAdmin.mutation(api.receipts.voidReceipt, {
      receiptId: first.receiptId,
      reason: "wrong student",
    });
    expect(await receipt(first.receiptId)).toMatchObject({ status: "voided" });
    const session = await t.run((ctx) => ctx.db.get(first.sessionId));
    expect(session?.status).toBe("voided");
    expect(await fee(f1)).toMatchObject({
      status: "unpaid",
      paidAmount: 0,
      balance: 1000,
    });
    expect(await fee(f2)).toMatchObject({
      status: "unpaid",
      paidAmount: 0,
      balance: 333,
    });
    const history = await txnsOf(f1);
    expect(history).toHaveLength(1);
    expect(history[0].voidedAt).toBeDefined();

    // Double void is rejected.
    await expect(
      asAdmin.mutation(api.receipts.voidReceipt, {
        receiptId: first.receiptId,
        reason: "again",
      }),
    ).rejects.toThrow(/already voided/);

    // Re-issue: collect again, then void+reissue with a corrected method.
    const second = await collect(s, [f1, f2]);
    expect(second.receiptNumber).toMatch(/00002$/);
    const third = await asAdmin.mutation(api.receipts.voidAndReissueReceipt, {
      receiptId: second.receiptId,
      reason: "paid by bank, not cash",
      paymentMode: "Bank Transfer",
    });
    expect(third.receiptNumber).toMatch(/00003$/);
    const old = await receipt(second.receiptId);
    const fresh = await receipt(third.receiptId);
    expect(old).toMatchObject({
      status: "voided",
      supersededBy: third.receiptId,
    });
    expect(fresh).toMatchObject({
      status: "issued",
      supersedes: second.receiptId,
      paymentMethod: "Bank Transfer",
      totalAmount: 1333,
    });
    expect(await fee(f1)).toMatchObject({ status: "paid", balance: 0 });
    // The void audit row of a re-issue names the replacement.
    const voidAudits = await t.run((ctx) =>
      ctx.db
        .query("auditLogs")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", "receipts").eq("entityId", second.receiptId),
        )
        .collect(),
    );
    expect(voidAudits).toHaveLength(1);
    expect(voidAudits[0].metadata.supersededBy).toBe(third.receiptId);
    // Exactly one live transaction per fee after the whole dance.
    const live = (await txnsOf(f1)).filter((x) => x.voidedAt === undefined);
    expect(live).toHaveLength(1);
    expect(live[0].paymentMode).toBe("Bank Transfer");

    // A voided receipt cannot be re-issued.
    await expect(
      asAdmin.mutation(api.receipts.voidAndReissueReceipt, {
        receiptId: second.receiptId,
        reason: "x",
        paymentMode: "Cash",
      }),
    ).rejects.toThrow(/already voided/);
  });

  it("rejects duplicate fee ids without writing anything", async () => {
    const s = await admit();
    const f1 = await assign(s, tuition);
    await expect(collect(s, [f1, f1])).rejects.toThrow(/more than once/);
    expect(await fee(f1)).toMatchObject({ status: "unpaid" });
    expect(
      await t.run((ctx) => ctx.db.query("receipts").collect()),
    ).toHaveLength(0);
  });

  it("rejects a stale expectedTotal", async () => {
    const s = await admit();
    const f1 = await assign(s, tuition);
    await expect(
      asAdmin.mutation(api.feeCollectionSessions.collectFees, {
        studentId: s,
        feeIds: [f1],
        paymentMode: "Cash",
        expectedTotal: 900,
      }),
    ).rejects.toThrow(/Amounts changed/);
  });

  it("rejects an invalid or future payment date on re-issue", async () => {
    const s = await admit();
    const f1 = await assign(s, tuition);
    const first = await collect(s, [f1]);
    for (const paymentDate of [Number.NaN, -1, Date.now() + 3 * 86_400_000]) {
      await expect(
        asAdmin.mutation(api.receipts.voidAndReissueReceipt, {
          receiptId: first.receiptId,
          reason: "x",
          paymentMode: "Cash",
          paymentDate,
        }),
      ).rejects.toThrow(/Invalid payment date/);
    }
    expect((await receipt(first.receiptId))?.status).toBe("issued");
  });

  it("re-issues a leaver's receipt but refuses a plain collect for them", async () => {
    const s = await admit();
    const f1 = await assign(s, tuition);
    const first = await collect(s, [f1]);
    await asAdmin.mutation(api.students.updateStudentStatus, {
      studentId: s,
      status: "withdrawn",
    });
    const f2 = await assign(s, books);
    await expect(collect(s, [f2])).rejects.toThrow(/non-active/);
    const re = await asAdmin.mutation(api.receipts.voidAndReissueReceipt, {
      receiptId: first.receiptId,
      reason: "method",
      paymentMode: "UPI",
    });
    expect((await receipt(re.receiptId))?.status).toBe("issued");
  });

  it("void restores a float-discounted fee exactly", async () => {
    const s = await admit();
    const f = await assign(s, books); // 333
    const { discountAmount } = await asAdmin.mutation(
      api.studentFees.applyDiscount,
      {
        feeId: f,
        discountRuleId: halfDiscount, // 7.5% of 333 = 24.975
      },
    );
    const expected = 333 - discountAmount;
    const r = await collect(s, [f]);
    await asAdmin.mutation(api.receipts.voidReceipt, {
      receiptId: r.receiptId,
      reason: "x",
    });
    expect(await fee(f)).toMatchObject({
      status: "unpaid",
      paidAmount: 0,
      balance: expected,
    });
  });

  it("void then delete the unpaid fee is allowed; a live payment blocks it", async () => {
    const s = await admit();
    const f = await assign(s, books);
    const r = await collect(s, [f]);
    await expect(
      asAdmin.mutation(api.studentFees.deleteStudentFee, { feeId: f }),
    ).rejects.toThrow(/paid fee/);
    await asAdmin.mutation(api.receipts.voidReceipt, {
      receiptId: r.receiptId,
      reason: "x",
    });
    await asAdmin.mutation(api.studentFees.deleteStudentFee, { feeId: f });
    expect(await fee(f)).toBeNull();
  });
});

describe("discounts never produce paid-without-transaction", () => {
  it("a 100% discount leaves the fee unpaid at balance 0; a ৳0 collect settles it with a receipt", async () => {
    const s = await admit();
    const f = await assign(s, tuition);
    const { balance } = await asAdmin.mutation(api.studentFees.applyDiscount, {
      feeId: f,
      discountRuleId: fullDiscount,
    });
    expect(balance).toBe(0);
    expect(await fee(f)).toMatchObject({
      status: "unpaid",
      balance: 0,
      paidAmount: 0,
    });
    expect(await txnsOf(f)).toHaveLength(0);

    const r = await collect(s, [f]);
    expect(r.totalAmount).toBe(0);
    expect(await fee(f)).toMatchObject({ status: "paid", balance: 0 });
    expect(await txnsOf(f)).toHaveLength(1);
    expect((await receipt(r.receiptId))?.lineItems[0]).toMatchObject({
      originalAmount: 1000,
      discountAmount: 1000,
      paidAmount: 0,
    });
  });

  it("refuses to discount a paid fee or a fee with nothing left", async () => {
    const s = await admit();
    const f = await assign(s, tuition);
    await asAdmin.mutation(api.studentFees.applyDiscount, {
      feeId: f,
      discountRuleId: fullDiscount,
    });
    await expect(
      asAdmin.mutation(api.studentFees.applyDiscount, {
        feeId: f,
        discountRuleId: halfDiscount,
      }),
    ).rejects.toThrow(/no balance left/);
    const g = await assign(s, books);
    await collect(s, [g]);
    await expect(
      asAdmin.mutation(api.studentFees.applyDiscount, {
        feeId: g,
        discountRuleId: halfDiscount,
      }),
    ).rejects.toThrow(/paid fee/);
  });

  it("every paid fee in the table has a live transaction", async () => {
    const s = await admit();
    const f1 = await assign(s, tuition);
    const f2 = await assign(s, books);
    await asAdmin.mutation(api.studentFees.applyDiscount, {
      feeId: f1,
      discountRuleId: fullDiscount,
    });
    await collect(s, [f1, f2]);
    const paid = await t.run((ctx) =>
      ctx.db
        .query("studentFees")
        .filter((q) => q.eq(q.field("status"), "paid"))
        .collect(),
    );
    for (const p of paid) {
      const live = (await txnsOf(p._id)).filter(
        (x) => x.voidedAt === undefined,
      );
      expect(live).toHaveLength(1);
    }
  });
});

describe("receipt numbers", () => {
  it("stay sequential across collects, voids and re-issues", async () => {
    const s = await admit();
    const ids = await Promise.all([
      assign(s, tuition, "2026-09"),
      assign(s, tuition, "2026-10"),
      assign(s, books),
    ]);
    const a = await collect(s, [ids[0]]);
    const b = await collect(s, [ids[1]]);
    await asAdmin.mutation(api.receipts.voidReceipt, {
      receiptId: a.receiptId,
      reason: "x",
    });
    const c = await collect(s, [ids[2]]);
    const d = await asAdmin.mutation(api.receipts.voidAndReissueReceipt, {
      receiptId: b.receiptId,
      reason: "x",
      paymentMode: "Cheque",
    });
    const seq = [a, b, c, d].map((r) => Number(r.receiptNumber.slice(-5)));
    expect(seq).toEqual([1, 2, 3, 4]);
  });
});

describe("deleteStudent", () => {
  it("is refused while any receipt exists, even a voided one", async () => {
    const s = await admit();
    const f = await assign(s, books);
    const r = await collect(s, [f]);
    await expect(
      asAdmin.mutation(api.students.deleteStudent, { studentId: s }),
    ).rejects.toThrow(/payment records/);
    await asAdmin.mutation(api.receipts.voidReceipt, {
      receiptId: r.receiptId,
      reason: "x",
    });
    await expect(
      asAdmin.mutation(api.students.deleteStudent, { studentId: s }),
    ).rejects.toThrow(/payment records/);
    expect(await t.run((ctx) => ctx.db.get(s))).not.toBeNull();
  });

  it("deletes a student with only unpaid fees and attendance", async () => {
    const s = await admit();
    const f = await assign(s, books);
    await t.run(async (ctx) => {
      const marker = await ctx.db.query("users").first();
      if (!marker) throw new Error("no user");
      await ctx.db.insert("attendance", {
        studentId: s,
        academicYear: year,
        standardLevelId: grade1,
        campus,
        date: "2026-09-01",
        status: "present",
        markedBy: marker._id,
        markedAt: 0,
      });
    });
    await asAdmin.mutation(api.students.deleteStudent, { studentId: s });
    expect(await fee(f)).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("attendance").collect()),
    ).toHaveLength(0);
  });
});

describe("permissions", () => {
  it("rejects every money mutation for a teacher", async () => {
    const s = await admit();
    const f = await assign(s, books);
    const r = await collect(s, [f]);
    const calls = [
      () =>
        asTeacher.mutation(api.studentFees.createStudentFee, {
          studentId: s,
          feeStructureId: books,
          academicYear: year,
        }),
      () =>
        asTeacher.mutation(api.studentFees.applyDiscount, {
          feeId: f,
          discountRuleId: halfDiscount,
        }),
      () =>
        asTeacher.mutation(api.feeCollectionSessions.collectFees, {
          studentId: s,
          feeIds: [f],
          paymentMode: "Cash",
        }),
      () =>
        asTeacher.mutation(api.receipts.voidReceipt, {
          receiptId: r.receiptId,
          reason: "x",
        }),
      () =>
        asTeacher.mutation(api.receipts.voidAndReissueReceipt, {
          receiptId: r.receiptId,
          reason: "x",
          paymentMode: "Cash",
        }),
      () => asTeacher.query(api.studentFees.getByStudent, { studentId: s }),
    ];
    for (const call of calls)
      await expect(call()).rejects.toThrow(/Unauthorized/);
  });
});
