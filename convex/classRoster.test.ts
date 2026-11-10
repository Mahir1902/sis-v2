/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

/**
 * A Class is campus + level + year (ADR-0007, #120). One roster
 * (`lib/placement.getClassRoster`) feeds mark entry, attendance and
 * promotion; Class Average / Position compare within one campus; an
 * enrollment with no campus is in no Class.
 */

const modules = import.meta.glob("./**/*.*s");
type TC = TestConvex<typeof schema>;

let t: TC;
let asAdmin: TC;
let grade4: Id<"standardLevels">;
let year: Id<"academicYears">;
let campusA: Id<"campuses">;
let campusB: Id<"campuses">;
let math: Id<"subjects">;

beforeEach(async () => {
  t = convexTest(schema, modules);
  const adminId = await t.run(async (ctx) => {
    grade4 = await ctx.db.insert("standardLevels", {
      name: "Grade 4",
      code: "04",
    });
    year = await ctx.db.insert("academicYears", {
      name: "2026-2027",
      startDate: 0,
      endDate: 1,
    });
    campusA = await ctx.db.insert("campuses", {
      name: "Campus A",
      address: "",
    });
    campusB = await ctx.db.insert("campuses", {
      name: "Campus B",
      address: "",
    });
    math = await ctx.db.insert("subjects", {
      name: "Math",
      code: "MATH",
      isActive: true,
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

function seedStudent(name: string) {
  return t.run((ctx) =>
    ctx.db.insert("students", {
      studentNumber: name.toUpperCase(),
      studentFullName: name,
      gender: "Male",
      dateOfBirth: 0,
      placeOfBirth: "Dhaka",
      citizenship: "BD",
      religion: "-",
      bloodGroup: "-",
      birthCertificateNumber: "-",
      admissionDate: 0,
      classStartDate: 0,
      presentAddress: "-",
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
      primaryBillingContact: "mother",
      familyAnnualIncome: "-",
      status: "active",
      consultantName: "-",
      createdAt: new Date().toISOString(),
    }),
  );
}

function enrol(
  studentId: Id<"students">,
  campus: Id<"campuses"> | undefined,
  extra: { exitDate?: number; enrollmentDate?: number } = {},
) {
  return t.run((ctx) =>
    ctx.db.insert("enrollments", {
      studentId,
      academicYear: year,
      standardLevelId: grade4,
      campus,
      enrollmentType: "new_admission",
      enrollmentDate: extra.enrollmentDate ?? 1000,
      exitDate: extra.exitDate,
    }),
  );
}

const classA = () => ({
  campus: campusA,
  standardLevelId: grade4,
  academicYear: year,
});
const classB = () => ({
  campus: campusB,
  standardLevelId: grade4,
  academicYear: year,
});

describe("getClassRoster", () => {
  it("is exact per campus, open enrollments only, one row per student", async () => {
    const amina = await seedStudent("Amina");
    const rafi = await seedStudent("Rafi");
    const mina = await seedStudent("Mina");
    const left = await seedStudent("Left");
    await enrol(amina, campusA);
    // A legacy duplicate open row for Rafi: the newest wins, listed once.
    await enrol(rafi, campusA, { enrollmentDate: 1 });
    const newest = await enrol(rafi, campusA, { enrollmentDate: 2 });
    await enrol(mina, campusB);
    await enrol(left, campusA, { exitDate: 5 });

    const a = await asAdmin.query(api.enrollments.getClassRoster, classA());
    expect(a.map((r) => r.studentName)).toEqual(["Amina", "Rafi"]);
    expect(a.find((r) => r.studentName === "Rafi")?.enrollmentId).toBe(newest);

    const b = await asAdmin.query(api.enrollments.getClassRoster, classB());
    expect(b.map((r) => r.studentName)).toEqual(["Mina"]);
  });

  it("does not truncate a large class (the old .take(200) dropped students)", async () => {
    await Promise.all(
      Array.from({ length: 250 }, async (_, i) => {
        const s = await seedStudent(`S${String(i).padStart(3, "0")}`);
        await enrol(s, campusA);
      }),
    );
    const roster = await asAdmin.query(
      api.enrollments.getClassRoster,
      classA(),
    );
    expect(roster).toHaveLength(250);
  });

  it("an enrollment with no campus is in no class and is reported", async () => {
    const ghost = await seedStudent("Ghost");
    const ghostRow = await enrol(ghost, undefined);
    const amina = await seedStudent("Amina");
    await enrol(amina, campusA);

    const a = await asAdmin.query(api.enrollments.getClassRoster, classA());
    expect(a.map((r) => r.studentName)).toEqual(["Amina"]);

    const report = await t.query(internal.migrations.placementReport, {});
    expect(report.noCampus).toEqual([
      { studentNumber: "GHOST", enrollmentId: ghostRow, academicYear: year },
    ]);
  });

  it("promotion candidates are one campus's class", async () => {
    const amina = await seedStudent("Amina");
    const mina = await seedStudent("Mina");
    await enrol(amina, campusA);
    await enrol(mina, campusB);

    const candidates = await asAdmin.query(
      api.promotions.getPromotionCandidates,
      { campus: campusB, standardLevelId: grade4, academicYearId: year },
    );
    expect(candidates.map((c) => c?.studentName)).toEqual(["Mina"]);
  });
});

describe("class analytics per campus", () => {
  /** Seed a final (1 of 1 CA present) Math grade for a student in a class. */
  async function grade(
    name: string,
    campus: Id<"campuses">,
    weightedAverage: number,
  ) {
    const studentId = await seedStudent(name);
    const enrollmentId = await enrol(studentId, campus);
    await t.run((ctx) =>
      ctx.db.insert("computedGrades", {
        studentId,
        enrollmentId,
        campus,
        standardLevelId: grade4,
        academicYear: year,
        subjectId: math,
        semester: 1,
        ca1Percentage: weightedAverage,
        weightedAverage,
        letterGrade: "B",
        expectedCaCount: 1,
      }),
    );
    return studentId;
  }

  beforeEach(async () => {
    // The paper is shared across campuses: one CA-1 Math for Grade 4.
    await t.run((ctx) =>
      ctx.db.insert("assessments", {
        name: "CA-1 Math",
        assessmentNumber: 1,
        semester: 1,
        subjectId: math,
        standardLevelId: grade4,
        academicYearId: year,
        totalMarks: 100,
        isActive: true,
      }),
    );
  });

  it("Class Average and Class Position compare within one campus", async () => {
    const a = [50, 60, 70, 80, 90];
    let top: Id<"students"> | null = null;
    for (const [i, avg] of a.entries()) {
      const id = await grade(`A${i}`, campusA, avg);
      if (avg === 90) top = id;
    }
    for (let i = 0; i < 6; i++) await grade(`B${i}`, campusB, 95);

    const avgA = await asAdmin.query(api.computedGrades.getClassAverages, {
      ...classA(),
      subjectId: math,
      semester: 1,
      studentId: top ?? undefined,
    });
    expect(avgA).toMatchObject({
      classAverage: 70,
      gradedCount: 5,
      sufficient: true,
    });
    expect(avgA.student?.delta).toBe(20);

    const avgB = await asAdmin.query(api.computedGrades.getClassAverages, {
      ...classB(),
      subjectId: math,
      semester: 1,
    });
    expect(avgB).toMatchObject({ classAverage: 95, gradedCount: 6 });

    // Pooled across campuses the 90 would stand 7th; in its own class it is 1st of 5.
    if (!top) throw new Error("seed");
    const pos = await asAdmin.query(api.computedGrades.getClassPositions, {
      ...classA(),
      semester: 1,
      studentId: top,
    });
    expect(pos.overall).toEqual({ rank: 1, outOf: 5 });
    expect(pos.bySubject[0]?.position).toEqual({ rank: 1, outOf: 5 });
  });

  it("a four-pupil campus class is suppressed even when the level has more", async () => {
    for (let i = 0; i < 4; i++) await grade(`A${i}`, campusA, 70);
    for (let i = 0; i < 6; i++) await grade(`B${i}`, campusB, 70);
    const avgA = await asAdmin.query(api.computedGrades.getClassAverages, {
      ...classA(),
      subjectId: math,
      semester: 1,
    });
    expect(avgA).toMatchObject({
      classAverage: null,
      gradedCount: 4,
      sufficient: false,
    });
  });

  it("amending a student's campus moves their grades to the new class", async () => {
    const studentId = await asAdmin.mutation(api.students.createStudent, {
      studentNumber: "S0126-0001",
      studentFullName: "Amina Rahman",
      gender: "Female",
      dateOfBirth: 0,
      placeOfBirth: "Dhaka",
      citizenship: "BD",
      religion: "Islam",
      bloodGroup: "O+",
      birthCertificateNumber: "BC-1",
      standardLevel: grade4,
      academicYear: year,
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
    const [open] = await asAdmin.query(
      api.enrollments.getClassRoster,
      classA(),
    );
    await t.run((ctx) =>
      ctx.db.insert("computedGrades", {
        studentId,
        enrollmentId: open.enrollmentId,
        campus: campusA,
        standardLevelId: grade4,
        academicYear: year,
        subjectId: math,
        semester: 1,
        ca1Percentage: 80,
        weightedAverage: 80,
        letterGrade: "A",
        expectedCaCount: 1,
      }),
    );

    await asAdmin.mutation(api.students.updateStudent, {
      studentId,
      placement: { standardLevelId: grade4, campus: campusB },
    });

    const rows = await t.run((ctx) =>
      ctx.db
        .query("computedGrades")
        .withIndex("by_enrollment_semester", (q) =>
          q.eq("enrollmentId", open.enrollmentId),
        )
        .collect(),
    );
    expect(rows.map((r) => r.campus)).toEqual([campusB]);
    expect(
      await asAdmin.query(api.enrollments.getClassRoster, classA()),
    ).toEqual([]);
  });
});
