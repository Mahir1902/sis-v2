/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

/**
 * Placement invariants (convex/lib/placement.ts, CONTEXT.md "Enrollment" /
 * "Current Placement"): at most one open enrollment, amend in place, suspend
 * keeps the class while leaving closes it, promotion's guard runs before any
 * write, and admission is one transaction.
 */

const modules = import.meta.glob("./**/*.*s");
type TC = TestConvex<typeof schema>;

let t: TC;
let asAdmin: TC;
let grade1: Id<"standardLevels">;
let grade2: Id<"standardLevels">;
let thisYear: Id<"academicYears">;
let nextYear: Id<"academicYears">;
let campusA: Id<"campuses">;
let campusB: Id<"campuses">;

beforeEach(async () => {
  t = convexTest(schema, modules);
  const adminId = await t.run(async (ctx) => {
    grade2 = await ctx.db.insert("standardLevels", {
      name: "Grade 2",
      code: "02",
    });
    grade1 = await ctx.db.insert("standardLevels", {
      name: "Grade 1",
      code: "01",
      nextLevelId: grade2,
    });
    thisYear = await ctx.db.insert("academicYears", {
      name: "2026-2027",
      startDate: 0,
      endDate: 1,
    });
    nextYear = await ctx.db.insert("academicYears", {
      name: "2027-2028",
      startDate: 2,
      endDate: 3,
    });
    campusA = await ctx.db.insert("campuses", {
      name: "Campus 01",
      address: "-",
    });
    campusB = await ctx.db.insert("campuses", {
      name: "Campus 02",
      address: "-",
    });
    return ctx.db.insert("users", {
      name: "Admin",
      email: "admin@school.edu",
      role: "admin",
      isActive: true,
    });
  });
  asAdmin = t.withIdentity({ subject: `${adminId}|session` }) as TC;
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
    academicYear: thisYear,
    campus: campusA,
    classStartDate: 0,
    presentAddress: "Uttara",
    healthIssue: { hasHealthIssues: false },
    fatherName: "F",
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

const enrollmentsOf = (studentId: Id<"students">) =>
  t.run((ctx) =>
    ctx.db
      .query("enrollments")
      .withIndex("by_student_academic_year", (q) =>
        q.eq("studentId", studentId),
      )
      .collect(),
  );
const openOf = async (studentId: Id<"students">) =>
  (await enrollmentsOf(studentId)).filter((e) => e.exitDate === undefined);
const setStatus = (
  studentId: Id<"students">,
  status: "active" | "suspended" | "withdrawn" | "graduated",
) => asAdmin.mutation(api.students.updateStudentStatus, { studentId, status });
const code = (c: string) => expect.objectContaining({ data: { code: c } });

describe("admission", () => {
  it("creates the student and exactly one open enrollment in one call", async () => {
    const studentId = await admit();

    const student = await t.run((ctx) => ctx.db.get(studentId));
    // The class is stored on the enrollment only.
    expect(student?.standardLevel).toBeUndefined();
    expect(student?.academicYear).toBeUndefined();
    expect(student?.campus).toBeUndefined();

    const open = await openOf(studentId);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      standardLevelId: grade1,
      academicYear: thisYear,
      campus: campusA,
      enrollmentType: "new_admission",
    });
    expect(open[0].status).toBeUndefined();
  });
});

describe("amend in place", () => {
  it("editing the class patches the open enrollment, never opening another", async () => {
    const studentId = await admit();
    const [before] = await openOf(studentId);

    await asAdmin.mutation(api.students.updateStudent, {
      studentId,
      placement: { standardLevelId: grade2, campus: campusB },
    });

    const all = await enrollmentsOf(studentId);
    expect(all).toHaveLength(1);
    expect(all[0]._id).toBe(before._id);
    expect(all[0]).toMatchObject({
      standardLevelId: grade2,
      campus: campusB,
      academicYear: thisYear,
    });

    // Header/sidebar (getStudentById) and rosters read the same class.
    const view = await asAdmin.query(api.students.getStudentById, {
      studentId,
    });
    expect(view?.standardLevelDoc?.name).toBe("Grade 2");
    expect(view?.campusDoc?.name).toBe("Campus 02");
    const roster = await asAdmin.query(api.enrollments.getClassRoster, {
      campus: campusB,
      standardLevelId: grade2,
      academicYear: thisYear,
    });
    expect(roster.map((r) => r.studentId)).toEqual([studentId]);
  });

  it("a leaver has no class to amend", async () => {
    const studentId = await admit();
    await setStatus(studentId, "withdrawn");
    await expect(
      asAdmin.mutation(api.students.updateStudent, {
        studentId,
        placement: { standardLevelId: grade2, campus: campusA },
      }),
    ).rejects.toEqual(code("NOT_PLACED"));
  });
});

describe("suspend vs withdraw", () => {
  it("suspension keeps the open enrollment; back to active is status only", async () => {
    const studentId = await admit();
    const [open] = await openOf(studentId);

    await setStatus(studentId, "suspended");
    expect(await openOf(studentId)).toEqual([open]);

    await setStatus(studentId, "active");
    expect(await openOf(studentId)).toEqual([open]);
  });

  it("withdrawal closes the open enrollment in the same call; no Current Placement after", async () => {
    const studentId = await admit();
    await setStatus(studentId, "withdrawn");

    const [closed] = await enrollmentsOf(studentId);
    expect(closed.exitDate).toBeTypeOf("number");
    expect(closed.exitReason).toBe("withdrawn");
    expect(
      await asAdmin.query(api.enrollments.getCurrentEnrollment, { studentId }),
    ).toBeNull();
    // No fallback to the last placement.
    const view = await asAdmin.query(api.students.getStudentById, {
      studentId,
    });
    expect(view?.placement).toBeNull();
    expect(view?.standardLevelDoc).toBeNull();
  });

  it("a leaver cannot go back to active or suspended — re-admission opens a new enrollment", async () => {
    const studentId = await admit();
    await setStatus(studentId, "withdrawn");

    await expect(setStatus(studentId, "active")).rejects.toEqual(
      code("STUDENT_HAS_LEFT"),
    );
    await expect(setStatus(studentId, "suspended")).rejects.toEqual(
      code("STUDENT_HAS_LEFT"),
    );

    await asAdmin.mutation(api.students.readmitStudent, {
      studentId,
      standardLevelId: grade1,
      academicYear: thisYear,
      campus: campusA,
    });
    const all = await enrollmentsOf(studentId);
    expect(all).toHaveLength(2);
    const open = await openOf(studentId);
    expect(open).toHaveLength(1);
    expect(open[0].enrollmentType).toBe("readmission");
    const student = await t.run((ctx) => ctx.db.get(studentId));
    expect(student?.status).toBe("active");
  });

  it("re-admitting a placed student is rejected — never two open enrollments", async () => {
    const studentId = await admit();
    await expect(
      asAdmin.mutation(api.students.readmitStudent, {
        studentId,
        standardLevelId: grade2,
        academicYear: thisYear,
        campus: campusA,
      }),
    ).rejects.toEqual(code("ALREADY_PLACED"));
    expect(await openOf(studentId)).toHaveLength(1);
  });

  it("the students list shows a leaver with no class and leaves them out of level filters", async () => {
    const stays = await admit("S0126-0001");
    const leaves = await admit("S0126-0002");
    await setStatus(leaves, "withdrawn");

    const all = await asAdmin.query(api.students.getAllStudents, {});
    const leaver = all.find((s) => s._id === leaves);
    expect(leaver?.standardLevelName).toBeNull();
    expect(all.find((s) => s._id === stays)?.standardLevelName).toBe("Grade 1");

    const filtered = await asAdmin.query(api.students.getAllStudents, {
      standardLevel: [grade1],
      academicYear: [thisYear],
    });
    expect(filtered.map((s) => s._id)).toEqual([stays]);
  });
});

describe("promotion", () => {
  const promote = (
    studentId: Id<"students">,
    enrollmentId: Id<"enrollments">,
    action: "promote" | "hold_back" | "graduate",
  ) =>
    asAdmin.mutation(api.promotions.bulkPromote, {
      sourceAcademicYearId: thisYear,
      targetAcademicYearId: nextYear,
      standardLevelId: grade1,
      promotions: [{ studentId, enrollmentId, action }],
      autoAssignFees: false,
    });

  it("closes the source and opens the next level in the target year", async () => {
    const studentId = await admit();
    const [source] = await openOf(studentId);

    const result = await promote(studentId, source._id, "promote");
    expect(result.promoted).toBe(1);

    const open = await openOf(studentId);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      academicYear: nextYear,
      standardLevelId: grade2,
      enrollmentType: "promotion",
      previousEnrollmentId: source._id,
    });
    const closed = await t.run((ctx) => ctx.db.get(source._id));
    expect(closed?.exitReason).toBe("promotion");
  });

  it("a skipped student (already enrolled in the target year) keeps their class", async () => {
    const studentId = await admit();
    const [source] = await openOf(studentId);
    // A closed enrollment already in the target year trips the guard.
    await t.run((ctx) =>
      ctx.db.insert("enrollments", {
        studentId,
        academicYear: nextYear,
        standardLevelId: grade2,
        enrollmentType: "promotion",
        enrollmentDate: 0,
        exitDate: 1,
        exitReason: "withdrawn",
      }),
    );

    for (const action of ["promote", "hold_back"] as const) {
      const result = await promote(studentId, source._id, action);
      expect(result.skipped).toBe(1);
      // Guard ran before any write: the source is still open.
      expect(await openOf(studentId)).toEqual([source]);
    }
  });

  it("graduation is the leave operation: status and close together", async () => {
    const studentId = await admit();
    const [source] = await openOf(studentId);
    await t.run((ctx) => ctx.db.patch(grade1, { nextLevelId: undefined }));

    await promote(studentId, source._id, "graduate");

    expect(await openOf(studentId)).toHaveLength(0);
    const [student, closed] = await t.run(async (ctx) => [
      await ctx.db.get(studentId),
      await ctx.db.get(source._id),
    ]);
    expect(student?.status).toBe("graduated");
    expect(closed?.exitReason).toBe("graduated");
  });
});

describe("placementReport (migration review)", () => {
  it("lists double-open, closed-as-suspended, drift, leavers with a class and unknown values", async () => {
    await t.run(async (ctx) => {
      const base = { createdAt: "2026-01-01T00:00:00.000Z" };
      const double = await ctx.db.insert("students", {
        ...base,
        studentNumber: "DOUBLE",
      });
      const suspended = await ctx.db.insert("students", {
        ...base,
        studentNumber: "SUSP",
        status: "suspended",
      });
      const drifted = await ctx.db.insert("students", {
        ...base,
        studentNumber: "DRIFT",
        standardLevel: grade2,
        academicYear: thisYear,
      });
      const leaver = await ctx.db.insert("students", {
        ...base,
        studentNumber: "LEFT",
        status: "withdrawn",
      });
      const open = (
        studentId: Id<"students">,
        extra: Record<string, unknown> = {},
      ) =>
        ctx.db.insert("enrollments", {
          studentId,
          academicYear: thisYear,
          standardLevelId: grade1,
          enrollmentType: "new_admission",
          enrollmentDate: 0,
          ...extra,
        });
      await open(double);
      await open(double, { enrollmentType: "regular" });
      await open(suspended, { exitDate: 1, exitReason: "suspended" });
      await open(drifted);
      await open(leaver);
    });

    const report = await t.query(internal.migrations.placementReport, {});
    expect(report.multipleOpen.map((r) => r.studentNumber)).toEqual(["DOUBLE"]);
    expect(report.closedAsSuspended.map((r) => r.studentNumber)).toEqual([
      "SUSP",
    ]);
    expect(report.notPlaced).toEqual([
      { studentNumber: "SUSP", status: "suspended", hasEnrollments: true },
    ]);
    expect(report.drift.map((r) => r.studentNumber)).toEqual(["DRIFT"]);
    expect(report.leaversWithOpen.map((r) => r.studentNumber)).toEqual([
      "LEFT",
    ]);
    expect(report.unknownEnrollmentTypes).toEqual({ regular: 1 });
  });
});
