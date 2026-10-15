/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { dhakaDate, shiftDate } from "../lib/attendanceDate";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

/**
 * Behavioural contracts for the attendance data layer (spec #111):
 *  - saveRegister checks uniqueness per (student, date), never per class, so a
 *    mid-year mover never gets a second row for the same day;
 *  - the audit row fires only when a status actually changes;
 *  - the write gate: nobody writes the future, teachers stop at 14 days;
 *  - the percentage denominator = union(class-marked dates, student's own
 *    dates) minus closed dates, with a no-row day counted absent;
 *  - closures.create asks before voiding existing marks and never deletes.
 */

const modules = import.meta.glob("./**/*.*s");
type TC = TestConvex<typeof schema>;

const DAY = 24 * 60 * 60 * 1000;
const today = dhakaDate();
const d = (daysAgo: number) => shiftDate(today, -daysAgo);

let t: TC;
let adminId: Id<"users">;
let teacherId: Id<"users">;
let campusA: Id<"campuses">;
let campusB: Id<"campuses">;
let grade3: Id<"standardLevels">;
let grade4: Id<"standardLevels">;
let yearId: Id<"academicYears">;
let yearNoSplit: Id<"academicYears">;

const asAdmin = () => t.withIdentity({ subject: `${adminId}|s` });
const asTeacher = () => t.withIdentity({ subject: `${teacherId}|s` });

async function seedStudent(name: string): Promise<Id<"students">> {
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
      standardLevel: grade4,
      academicYear: yearId,
      campus: campusA,
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

async function enrol(
  studentId: Id<"students">,
  level: Id<"standardLevels">,
  campus: Id<"campuses">,
) {
  return t.run((ctx) =>
    ctx.db.insert("enrollments", {
      studentId,
      academicYear: yearId,
      standardLevelId: level,
      campus,
      enrollmentType: "new_admission",
      enrollmentDate: Date.now(),
      status: "active",
    }),
  );
}

const rowsFor = (studentId: Id<"students">) =>
  t.run((ctx) =>
    ctx.db
      .query("attendance")
      .withIndex("by_student_date", (q) => q.eq("studentId", studentId))
      .collect(),
  );

const auditRows = () =>
  t.run((ctx) =>
    ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) => q.eq("entityType", "attendance"))
      .collect(),
  );

beforeEach(async () => {
  t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    adminId = await ctx.db.insert("users", {
      name: "Admin",
      email: "admin@school.edu",
      role: "admin",
      isActive: true,
    });
    teacherId = await ctx.db.insert("users", {
      name: "Teacher",
      email: "teacher@school.edu",
      role: "teacher",
      isActive: true,
    });
    campusA = await ctx.db.insert("campuses", {
      name: "Campus A",
      address: "",
    });
    campusB = await ctx.db.insert("campuses", {
      name: "Campus B",
      address: "",
    });
    grade3 = await ctx.db.insert("standardLevels", {
      name: "Grade 3",
      code: "03",
    });
    grade4 = await ctx.db.insert("standardLevels", {
      name: "Grade 4",
      code: "04",
    });
    const now = Date.now();
    yearId = await ctx.db.insert("academicYears", {
      name: "Test Year",
      startDate: now - 200 * DAY,
      semester1EndDate: now + 10 * DAY,
      endDate: now + 160 * DAY,
    });
    yearNoSplit = await ctx.db.insert("academicYears", {
      name: "No Split",
      startDate: now - 200 * DAY,
      endDate: now + 160 * DAY,
    });
  });
});

const grade4A = () => ({
  campus: campusA,
  standardLevelId: grade4,
  academicYear: yearId,
});

describe("saveRegister", () => {
  it("re-freezes a mover's existing row instead of inserting a second one", async () => {
    const rafi = await seedStudent("Rafi");
    await enrol(rafi, grade4, campusA);
    const date = d(2);

    // Rafi was marked under Grade 3 earlier that day (before the class move).
    await asAdmin().mutation(api.attendance.saveRegister, {
      campus: campusA,
      standardLevelId: grade3,
      academicYear: yearId,
      date,
      marks: [{ studentId: rafi, status: "present" }],
    });
    // Grade 4 marks him again the same day.
    const result = await asAdmin().mutation(api.attendance.saveRegister, {
      ...grade4A(),
      date,
      marks: [{ studentId: rafi, status: "late" }],
    });

    expect(result).toEqual({ created: 0, updated: 1, unchanged: 0 });
    const rows = await rowsFor(rafi);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("late");
    expect(rows[0].standardLevelId).toBe(grade4);
  });

  it("writes one audit row with old → new only when the status changes", async () => {
    const rafi = await seedStudent("Rafi");
    const date = d(1);
    const mark = (status: "present" | "absent") =>
      asAdmin().mutation(api.attendance.saveRegister, {
        ...grade4A(),
        date,
        marks: [{ studentId: rafi, status }],
      });

    expect(await mark("present")).toEqual({
      created: 1,
      updated: 0,
      unchanged: 0,
    });
    expect(await mark("present")).toEqual({
      created: 0,
      updated: 0,
      unchanged: 1,
    });
    expect(await auditRows()).toHaveLength(0);

    expect(await mark("absent")).toEqual({
      created: 0,
      updated: 1,
      unchanged: 0,
    });
    const audit = await auditRows();
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toMatchObject({ from: "present", to: "absent" });
  });

  it("blocks future dates for everyone and old dates for teachers only", async () => {
    const rafi = await seedStudent("Rafi");
    const mark = (who: ReturnType<typeof asAdmin>, date: string) =>
      who.mutation(api.attendance.saveRegister, {
        ...grade4A(),
        date,
        marks: [{ studentId: rafi, status: "present" }],
      });

    await expect(mark(asAdmin(), shiftDate(today, 1))).rejects.toThrow(
      "future",
    );
    await expect(mark(asTeacher(), d(15))).rejects.toThrow("correction window");
    await expect(mark(asTeacher(), d(14))).resolves.toBeTruthy();
    await expect(mark(asAdmin(), d(15))).resolves.toBeTruthy();
  });
});

describe("getClassReport — the denominator", () => {
  it("unions class-marked and student dates, drops closed days, counts no-row days absent", async () => {
    const rafi = await seedStudent("Rafi");
    const mina = await seedStudent("Mina");
    await enrol(rafi, grade4, campusA);
    await enrol(mina, grade4, campusA);

    const mark = (
      date: string,
      marks: Array<[Id<"students">, "present" | "absent" | "late"]>,
      cls = grade4A(),
    ) =>
      asAdmin().mutation(api.attendance.saveRegister, {
        ...cls,
        date,
        marks: marks.map(([studentId, status]) => ({ studentId, status })),
      });

    // Rafi was in Grade 3 on day 5 — a date Grade 4 was never marked.
    await mark(d(5), [[rafi, "present"]], {
      campus: campusA,
      standardLevelId: grade3,
      academicYear: yearId,
    });
    // Grade 4 marked on days 4, 3, 2; Mina has no row on day 2.
    await mark(d(4), [
      [rafi, "present"],
      [mina, "present"],
    ]);
    await mark(d(3), [
      [rafi, "late"],
      [mina, "absent"],
    ]);
    await mark(d(2), [[rafi, "absent"]]);
    // Day 3 is closed for Campus A — voided for everyone, marks kept.
    await asAdmin().mutation(api.closures.create, {
      startDate: d(3),
      endDate: d(3),
      campuses: [campusA],
      reason: "hartal",
      confirmVoid: true,
    });

    const report = await asAdmin().query(api.attendance.getClassReport, {
      ...grade4A(),
      semester: 1,
    });
    expect(report.classMarkedDays).toBe(2); // days 4 and 2
    expect(report.classFirstMarked).toBe(d(4));

    const byName = Object.fromEntries(
      report.students.map((s) => [s.studentName, s]),
    );
    // Rafi: union {5,4,3,2} minus closed {3} = 3 days; present 2, absent 1.
    expect(byName.Rafi).toMatchObject({
      present: 2,
      late: 0,
      absent: 1,
      denominator: 3,
      firstAppearance: null,
    });
    // Mina: class days {4,2}; present 1, no row on day 2 → absent 1.
    expect(byName.Mina).toMatchObject({
      present: 1,
      late: 0,
      absent: 1,
      denominator: 2,
    });

    // The marks under the closure were never deleted.
    expect(await rowsFor(mina)).toHaveLength(2);

    // Same arithmetic from the student side, with the missed days listed.
    const mine = await asTeacher().query(api.attendance.getStudentAttendance, {
      studentId: mina,
      academicYear: yearId,
      semester: 1,
    });
    expect(mine).toMatchObject({ present: 1, absent: 1, denominator: 2 });
    expect(mine.missedDays).toEqual([
      { date: d(2), status: "absent", note: null },
    ]);
  });

  it("keeps a completed enrollment in the report and the year's class list", async () => {
    const rafi = await seedStudent("Rafi");
    const enrollmentId = await enrol(rafi, grade4, campusA);
    await asAdmin().mutation(api.attendance.saveRegister, {
      ...grade4A(),
      date: d(2),
      marks: [{ studentId: rafi, status: "present" }],
    });
    await t.run((ctx) => ctx.db.patch(enrollmentId, { status: "completed" }));

    const report = await asAdmin().query(api.attendance.getClassReport, {
      ...grade4A(),
      semester: 1,
    });
    expect(report.students).toHaveLength(1);
    expect(report.students[0]).toMatchObject({
      studentName: "Rafi",
      present: 1,
      denominator: 1,
    });

    const classes = await asAdmin().query(api.enrollments.getClassesForYear, {
      academicYear: yearId,
    });
    expect(classes).toHaveLength(1);
    // The marking register stays active-only.
    expect(
      await asAdmin().query(api.enrollments.getClassRoster, grade4A()),
    ).toEqual([]);
  });

  it("counts distinct active students per class in the year's class list", async () => {
    const rafi = await seedStudent("Rafi");
    const mina = await seedStudent("Mina");
    const old = await enrol(rafi, grade4, campusA);
    await t.run((ctx) => ctx.db.patch(old, { status: "completed" }));
    await enrol(rafi, grade4, campusA);
    await enrol(rafi, grade4, campusA);
    const minaGrade3 = await enrol(mina, grade3, campusA);
    await t.run((ctx) => ctx.db.patch(minaGrade3, { status: "completed" }));

    const classes = await asAdmin().query(api.enrollments.getClassesForYear, {
      academicYear: yearId,
    });
    expect(
      Object.fromEntries(classes.map((c) => [c.levelName, c.studentCount])),
    ).toEqual({ "Grade 3": 0, "Grade 4": 1 });
  });

  it("getDay totals only classes with active students", async () => {
    const rafi = await seedStudent("Rafi");
    const mina = await seedStudent("Mina");
    await enrol(rafi, grade4, campusA);
    const minaGrade3 = await enrol(mina, grade3, campusA);
    await asAdmin().mutation(api.attendance.saveRegister, {
      ...grade4A(),
      date: d(1),
      marks: [{ studentId: rafi, status: "present" }],
    });
    await asAdmin().mutation(api.attendance.saveRegister, {
      campus: campusA,
      standardLevelId: grade3,
      academicYear: yearId,
      date: d(1),
      marks: [{ studentId: mina, status: "absent" }],
    });
    await t.run((ctx) => ctx.db.patch(minaGrade3, { status: "completed" }));

    const day = await asAdmin().query(api.attendance.getDay, {
      date: d(1),
      academicYear: yearId,
    });
    expect(day).toMatchObject({ classesMarked: 1, classesTotal: 1 });
    expect(day.groups.map((g) => g.levelName).sort()).toEqual([
      "Grade 3",
      "Grade 4",
    ]);

    const emptyDay = await asAdmin().query(api.attendance.getDay, {
      date: d(2),
      academicYear: yearId,
    });
    expect(emptyDay).toMatchObject({ classesMarked: 0, classesTotal: 1 });
    expect(emptyDay.groups.map((g) => g.levelName)).toEqual(["Grade 4"]);
  });

  it("returns no figure for a year without a semester split", async () => {
    const report = await asAdmin().query(api.attendance.getClassReport, {
      campus: campusA,
      standardLevelId: grade4,
      academicYear: yearNoSplit,
      semester: 1,
    });
    expect(report.periodStart).toBeNull();
    expect(report.students).toEqual([]);
  });
});

describe("closures.create", () => {
  it("asks for confirmation when marks exist on the target dates, then writes one row per date", async () => {
    const rafi = await seedStudent("Rafi");
    await asAdmin().mutation(api.attendance.saveRegister, {
      ...grade4A(),
      date: d(3),
      marks: [{ studentId: rafi, status: "present" }],
    });

    const args = {
      startDate: d(4),
      endDate: d(2),
      campuses: [campusA, campusB],
      reason: "Eid",
    };
    expect(await asAdmin().mutation(api.closures.create, args)).toEqual({
      ok: false,
      needsConfirmation: true,
      markCount: 1,
      classCount: 1,
    });
    expect(
      await asAdmin().mutation(api.closures.create, {
        ...args,
        confirmVoid: true,
      }),
    ).toEqual({ ok: true, created: 3 });

    // A closure on another campus does not need confirmation.
    expect(
      await asAdmin().mutation(api.closures.create, {
        startDate: d(10),
        endDate: d(10),
        campuses: [campusB],
        reason: "flood",
      }),
    ).toEqual({ ok: true, created: 1 });

    const listed = await asTeacher().query(api.closures.list, {
      academicYear: yearId,
    });
    expect(listed.map((c) => c.date).sort()).toEqual(
      [d(10), d(4), d(3), d(2)].sort(),
    );
  });

  it("merges campuses into an existing row for the same date", async () => {
    const base = { startDate: d(3), endDate: d(3), reason: "Eid" };
    await asAdmin().mutation(api.closures.create, {
      ...base,
      campuses: [campusA],
    });
    await asAdmin().mutation(api.closures.create, {
      ...base,
      campuses: [campusA, campusB],
    });
    const rows = await t.run((ctx) => ctx.db.query("closures").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].campuses.sort()).toEqual([campusA, campusB].sort());
  });

  it("rejects impossible calendar dates", async () => {
    await expect(
      asAdmin().mutation(api.closures.create, {
        startDate: "2026-02-30",
        endDate: "2026-02-30",
        campuses: [campusA],
        reason: "x",
      }),
    ).rejects.toThrow("real calendar days");
    await expect(
      asAdmin().query(api.attendance.getDay, {
        date: "2026-00-99",
        academicYear: yearId,
      }),
    ).rejects.toThrow("real calendar day");
  });
});
