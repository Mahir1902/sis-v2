/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { IMPORT_ACADEMIC_YEAR, type ImportRow } from "./studentImport";

/**
 * Behavioural contracts for the Excel import's write path (spec §5, #97).
 *
 * The seam is the two public Convex functions against a real test database —
 * the same seam the invite suite uses. The pure column→field mapping is
 * already covered by `lib/studentImportMapping.test.ts`; nothing here re-tests
 * it.
 *
 * Not covered by a test, enforced structurally: "reference data is resolved
 * once per call". `convex-test` exposes no read counter, so the guarantee is
 * that the three lookup maps are built before the per-row `Promise.all` and
 * are the only place a level/year/campus is read.
 */

const modules = import.meta.glob("./**/*.*s");

type TC = TestConvex<typeof schema>;

let t: TC;
let asAdmin: TC;
let adminId: Id<"users">;
let grade1: Id<"standardLevels">;
let grade2: Id<"standardLevels">;
let campus1: Id<"campuses">;
let currentYear: Id<"academicYears">;

/** Seeds the reference data the import joins against, plus an admin caller. */
async function seedReference(tc: TC, withCurrentYear = true) {
  return tc.run(async (ctx) => {
    grade1 = await ctx.db.insert("standardLevels", {
      name: "Grade 1",
      code: "01",
    });
    grade2 = await ctx.db.insert("standardLevels", {
      name: "Grade 2",
      code: "02",
    });
    campus1 = await ctx.db.insert("campuses", {
      name: "Campus 01",
      address: "Dhaka",
    });
    await ctx.db.insert("academicYears", {
      name: "2021-2022",
      startDate: 0,
      endDate: 1,
    });
    if (withCurrentYear) {
      currentYear = await ctx.db.insert("academicYears", {
        name: IMPORT_ACADEMIC_YEAR,
        startDate: 2,
        endDate: 3,
      });
    }
    return ctx.db.insert("users", {
      name: "Admin",
      email: "admin@school.edu",
      role: "admin",
      isActive: true,
    });
  });
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  adminId = await seedReference(t);
  asAdmin = t.withIdentity({ subject: `${adminId}|session` }) as TC;
});

/** Real student numbers — the school's `S{MM}{YY}-{seq}` shape (§3.2 R1). */
const NUMBER = "S0724-1304";
const NUMBER_2 = "S0724-1305";

const row = (over: Partial<ImportRow> = {}): ImportRow => ({
  studentNumber: NUMBER,
  standardLevel: "Grade 1",
  ...over,
});

const commit = (rows: ImportRow[], runId = "run-1", batch = 1) =>
  asAdmin.mutation(api.studentImport.commitImportBatch, { runId, batch, rows });

const studentByNumber = (studentNumber: string) =>
  t.run((ctx) =>
    ctx.db
      .query("students")
      .withIndex("by_student_number", (q) =>
        q.eq("studentNumber", studentNumber),
      )
      .first(),
  );

/** Same lookup, for the cases where the student must be there by now. */
async function existingStudent(studentNumber: string) {
  const student = await studentByNumber(studentNumber);
  if (!student) throw new Error(`${studentNumber} was not written`);
  return student;
}

const enrollmentsOf = (studentId: Id<"students">) =>
  t.run((ctx) =>
    ctx.db
      .query("enrollments")
      .withIndex("by_student_academic_year", (q) =>
        q.eq("studentId", studentId),
      )
      .collect(),
  );

const auditRows = () =>
  t.run((ctx) => ctx.db.query("auditLogs").withIndex("by_timestamp").collect());

describe("permissions", () => {
  it("commitImportBatch rejects a non-admin caller", async () => {
    const teacherId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Teacher",
        email: "teacher@school.edu",
        role: "teacher",
        isActive: true,
      }),
    );

    await expect(
      t
        .withIdentity({ subject: `${teacherId}|s` })
        .mutation(api.studentImport.commitImportBatch, {
          runId: "run-1",
          batch: 1,
          rows: [row()],
        }),
    ).rejects.toThrow("Unauthorized");

    expect(await studentByNumber(NUMBER)).toBeNull();
  });

  it("getExistingStudents rejects a non-admin caller", async () => {
    await expect(
      t.query(api.studentImport.getExistingStudents, {
        studentNumbers: [NUMBER],
      }),
    ).rejects.toThrow("Unauthenticated");
  });
});

describe("commitImportBatch — insert", () => {
  it("inserts a student and exactly one current enrollment row", async () => {
    const result = await commit([
      row({
        studentNumber: NUMBER,
        studentFullName: "Amina Rahman",
        standardLevel: "Grade 2",
        campus: "Campus 01",
        gender: "Female",
        dateOfBirth: 1_000_000,
        admittedLevel: "Grade 1",
        admissionAcademicYear: "2021-2022",
        status: "active",
      }),
    ]);

    expect(result).toEqual([{ studentNumber: NUMBER, action: "inserted" }]);

    const student = await existingStudent(NUMBER);
    expect(student).toMatchObject({
      studentFullName: "Amina Rahman",
      standardLevel: grade2,
      academicYear: currentYear,
      campus: campus1,
      gender: "Female",
      dateOfBirth: 1_000_000,
      admittedLevel: grade1,
      status: "active",
    });

    const enrollments = await enrollmentsOf(student._id);
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0]).toMatchObject({
      academicYear: currentYear,
      standardLevelId: grade2,
      campus: campus1,
      enrollmentType: "new_admission",
      status: "active",
    });
    expect(enrollments[0].exitDate).toBeUndefined();
    expect(enrollments[0].previousEnrollmentId).toBeUndefined();
  });

  it("writes the derived admission date the preview showed", async () => {
    // R5: it mirrors CLASS STARTING DATE. Dropping it here would make the
    // inspector's `derived` pill a promise the write does not keep.
    await commit([
      row({ classStartDate: 1_000_000, admissionDate: 1_000_000 }),
    ]);

    expect(await existingStudent(NUMBER)).toMatchObject({
      classStartDate: 1_000_000,
      admissionDate: 1_000_000,
    });
  });

  it("leaves an absent field unset rather than inventing a placeholder", async () => {
    await commit([row()]);

    const student = await studentByNumber(NUMBER);
    expect(student?.studentFullName).toBeUndefined();
    expect(student?.status).toBeUndefined();
    expect(student?.admissionDate).toBeUndefined();
  });
});

describe("commitImportBatch — re-commit (upsert)", () => {
  it("patches in place: one student document, one enrollment row", async () => {
    await commit([row({ studentFullName: "Old Name" })]);
    const result = await commit(
      [row({ studentFullName: "New Name" })],
      "run-2",
    );

    expect(result).toEqual([{ studentNumber: NUMBER, action: "updated" }]);

    const all = await t.run((ctx) => ctx.db.query("students").collect());
    expect(all).toHaveLength(1);
    expect(all[0].studentFullName).toBe("New Name");
    expect(await enrollmentsOf(all[0]._id)).toHaveLength(1);
  });

  it("keeps a field set in-app that the import does not carry", async () => {
    await commit([row({ studentFullName: "Amina", fatherName: "Karim" })]);
    const student = await existingStudent(NUMBER);

    // An admin edits in the app between uploads: a field the import never
    // writes (siblingIds — the case this rule exists for), one it writes only
    // when the sheet has it, and one the sheet does carry.
    const sibling = await t.run((ctx) =>
      ctx.db.insert("students", {
        studentNumber: "S0724-1400",
        standardLevel: grade1,
        academicYear: currentYear,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    await t.run((ctx) =>
      ctx.db.patch(student._id, {
        siblingIds: [sibling],
        fatherOccupation: "Engineer",
        fatherName: "Edited In App",
      }),
    );

    // Second upload: no FATHER'S NAME cell this time, new student name.
    await commit([row({ studentFullName: "Amina Rahman" })], "run-2");

    const after = await studentByNumber(NUMBER);
    expect(after?.siblingIds).toEqual([sibling]);
    expect(after?.fatherOccupation).toBe("Engineer");
    expect(after?.fatherName).toBe("Edited In App");
    // ...and where the sheet does have a value, the sheet wins (D7).
    expect(after?.studentFullName).toBe("Amina Rahman");
  });

  it("clears the exit block — a student on the sheet is enrolled", async () => {
    await commit([row()]);
    const student = await existingStudent(NUMBER);
    const enrollment = (await enrollmentsOf(student._id))[0];

    // The student was withdrawn in-app, then turns up on the next sheet.
    await t.run((ctx) =>
      ctx.db.patch(enrollment._id, {
        status: "completed",
        exitDate: 1_700_000_000_000,
        exitReason: "withdrawn",
      }),
    );

    await commit([row()], "run-2");

    const after = (await enrollmentsOf(student._id))[0];
    expect(after.status).toBe("active");
    // Current enrollment is detected via exitDate === undefined; active with an
    // exit date would be two answers to the same question.
    expect(after.exitDate).toBeUndefined();
    expect(after.exitReason).toBeUndefined();
  });

  it("preserves the original enrollment date, never re-stamping it", async () => {
    await commit([row()]);
    const student = await existingStudent(NUMBER);
    const first = (await enrollmentsOf(student._id))[0];

    // Age the row so a re-stamp would be unmistakable.
    await t.run((ctx) =>
      ctx.db.patch(first._id, { enrollmentDate: 1_700_000_000_000 }),
    );

    await commit([row({ standardLevel: "Grade 2" })], "run-2");

    const after = await enrollmentsOf(student._id);
    expect(after).toHaveLength(1);
    expect(after[0].enrollmentDate).toBe(1_700_000_000_000);
    expect(after[0].standardLevelId).toBe(grade2);
  });

  it("completes a run whose first attempt died between batches", async () => {
    // §3.3: no rollback, because there is nothing to roll back. The admin
    // re-uploads the same file; batch 1's rows are rewritten identically and
    // batch 2's land for the first time.
    await commit([row({ studentNumber: NUMBER })], "run-1", 1);
    // …the browser is closed here, before batch 2 ever goes out.

    await commit([row({ studentNumber: NUMBER })], "run-2", 1);
    await commit([row({ studentNumber: NUMBER_2 })], "run-2", 2);

    const students = await t.run((ctx) => ctx.db.query("students").collect());
    expect(students.map((s) => s.studentNumber).sort()).toEqual([
      NUMBER,
      NUMBER_2,
    ]);
    for (const student of students) {
      expect(await enrollmentsOf(student._id)).toHaveLength(1);
    }
  });
});

describe("commitImportBatch — audit", () => {
  it("writes one audit row per batch carrying the run id and both lists", async () => {
    await commit([row({ studentNumber: NUMBER })], "run-42");
    await commit(
      [row({ studentNumber: NUMBER }), row({ studentNumber: NUMBER_2 })],
      "run-42",
      2,
    );

    const logs = await auditRows();
    expect(logs).toHaveLength(2);
    expect(logs[1]).toMatchObject({
      action: "upload",
      entityId: "run-42",
      userId: adminId,
      metadata: {
        runId: "run-42",
        // Nothing server-side tracks a run, so the batch index is the only
        // thing that orders its audit documents.
        batch: 2,
        inserted: [NUMBER_2],
        updated: [NUMBER],
      },
    });
  });
});

describe("commitImportBatch — server-side validation", () => {
  it("rejects a class name the reference data does not have", async () => {
    await expect(commit([row({ standardLevel: "Grade 99" })])).rejects.toThrow(
      /Grade 99/,
    );
    expect(await studentByNumber(NUMBER)).toBeNull();
  });

  it("rejects an unknown campus and an unknown admission year", async () => {
    await expect(commit([row({ campus: "Campus 09" })])).rejects.toThrow(
      /Campus 09/,
    );
    await expect(
      commit([row({ admissionAcademicYear: "1999-2000" })]),
    ).rejects.toThrow(/1999-2000/);

    // Rejected, never created.
    const years = await t.run((ctx) => ctx.db.query("academicYears").collect());
    expect(years.map((y) => y.name).sort()).toEqual([
      "2021-2022",
      IMPORT_ACADEMIC_YEAR,
    ]);
  });

  it("rejects an unknown current academic year rather than creating it", async () => {
    const bare = convexTest(schema, modules);
    const bareAdmin = await seedReference(bare, false);

    await expect(
      bare
        .withIdentity({ subject: `${bareAdmin}|s` })
        .mutation(api.studentImport.commitImportBatch, {
          runId: "run-1",
          batch: 1,
          rows: [row()],
        }),
    ).rejects.toThrow(IMPORT_ACADEMIC_YEAR);

    expect(
      await bare.run((ctx) => ctx.db.query("academicYears").collect()),
    ).toHaveLength(1);
  });

  it("rejects payloads the browser would never produce", async () => {
    // Blank student number.
    await expect(commit([row({ studentNumber: "  " })])).rejects.toThrow();
    // Same student twice in one batch — would mint two documents.
    await expect(
      commit([row({ studentNumber: NUMBER }), row({ studentNumber: NUMBER })]),
    ).rejects.toThrow(new RegExp(NUMBER));
    // A date that is not a date.
    await expect(commit([row({ dateOfBirth: Number.NaN })])).rejects.toThrow();
    // A field outside the mapped set.
    await expect(
      asAdmin.mutation(api.studentImport.commitImportBatch, {
        runId: "run-1",
        batch: 1,
        // biome-ignore lint/suspicious/noExplicitAny: hostile payload by design
        rows: [{ ...row(), isActive: true } as any],
      }),
    ).rejects.toThrow();
    // No run id to stitch the audit rows together.
    await expect(commit([row()], "  ")).rejects.toThrow();

    expect(await t.run((ctx) => ctx.db.query("students").collect())).toEqual(
      [],
    );
  });

  it("catches a duplicate disguised by whitespace", async () => {
    // Both collapse to "S0724 1304" on the way to the database (§1.5), so the
    // guard has to collapse too — trimming alone lets these through and they
    // land as two documents for one student.
    await expect(
      commit([
        row({ studentNumber: "S0724 1304" }),
        row({ studentNumber: "S0724  1304" }),
      ]),
    ).rejects.toThrow(/S0724 1304/);

    expect(await t.run((ctx) => ctx.db.query("students").collect())).toEqual(
      [],
    );
  });
});

describe("getExistingStudents", () => {
  const existingFor = (studentNumbers: string[]) =>
    asAdmin.query(api.studentImport.getExistingStudents, { studentNumbers });

  it("returns only the numbers already in the database", async () => {
    await commit([row({ studentNumber: NUMBER })]);

    const existing = await existingFor([NUMBER, NUMBER_2]);

    expect(existing.map((s) => s.studentNumber)).toEqual([NUMBER]);
  });

  it("matches the same number the commit does, whitespace and all", async () => {
    await commit([row({ studentNumber: "S0724-1304" })]);

    const existing = await existingFor([" S0724-1304 "]);

    expect(existing.map((s) => s.studentNumber)).toEqual(["S0724-1304"]);
  });

  it("returns each mapped field as the preview renders it, for the old → new diff", async () => {
    await commit([
      row({
        studentNumber: NUMBER,
        studentFullName: "Amina Rahman",
        standardLevel: "Grade 2",
        campus: "Campus 01",
        admittedLevel: "Grade 1",
        admissionAcademicYear: "2021-2022",
        // 2016-03-21 at UTC midnight — the preview renders dates as YYYY-MM-DD.
        dateOfBirth: Date.UTC(2016, 2, 21),
        fatherPhoneNumber: "01711111111",
      }),
    ]);

    const [existing] = await existingFor([NUMBER]);

    expect(existing.fields).toMatchObject({
      studentFullName: "Amina Rahman",
      // Ids resolve to names: the inspector shows what the sheet would say.
      standardLevel: "Grade 2",
      campus: "Campus 01",
      admittedLevel: "Grade 1",
      admissionAcademicYear: "2021-2022",
      dateOfBirth: "2016-03-21",
      fatherPhoneNumber: "01711111111",
      // A field the school never filled is null, not absent — otherwise the
      // inspector cannot tell "unchanged" from "we did not look".
      motherName: null,
    });
  });
});
