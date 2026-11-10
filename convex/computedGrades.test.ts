/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import migrationsSchema from "../node_modules/@convex-dev/migrations/src/component/schema";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

/**
 * `computedGrades` never go stale (architecture review candidate 6).
 * Mark entry recomputes in the same transaction; CA / question changes
 * recompute the whole class through the scheduled, chunked batch; placement
 * amend keeps the denormalised level in step. Math per ADR-0004 / CONTEXT.md
 * ("Present CA", "Absent vs Unmarked", "Provisional Grade").
 */

const modules = import.meta.glob("./**/*.*s");
const migrationsModules = import.meta.glob(
  "../node_modules/@convex-dev/migrations/src/component/**/*.ts",
);
type TC = TestConvex<typeof schema>;

let t: TC;
let asAdmin: TC;
let grade4: Id<"standardLevels">;
let grade5: Id<"standardLevels">;
let year: Id<"academicYears">;
let math: Id<"subjects">;
let students: Id<"students">[];
let enrollments: Id<"enrollments">[];

const CLASS_SIZE = 6;

beforeEach(async () => {
  vi.useFakeTimers();
  t = convexTest(schema, modules);
  t.registerComponent("migrations", migrationsSchema, migrationsModules);
  const adminId = await t.run(async (ctx) => {
    grade4 = await ctx.db.insert("standardLevels", {
      name: "Grade 4",
      code: "04",
    });
    grade5 = await ctx.db.insert("standardLevels", {
      name: "Grade 5",
      code: "05",
    });
    year = await ctx.db.insert("academicYears", {
      name: "2026-2027",
      startDate: 0,
      endDate: 1,
    });
    math = await ctx.db.insert("subjects", {
      name: "Math",
      code: "MATH",
      isActive: true,
    });
    students = [];
    enrollments = [];
    for (let i = 0; i < CLASS_SIZE; i++) {
      const studentId = await ctx.db.insert("students", {
        studentNumber: `S-${i}`,
        studentFullName: `Student ${i}`,
        status: "active",
        createdAt: new Date(0).toISOString(),
      });
      students.push(studentId);
      enrollments.push(
        await ctx.db.insert("enrollments", {
          studentId,
          academicYear: year,
          standardLevelId: grade4,
          enrollmentType: "new_admission",
          enrollmentDate: 0,
        }),
      );
    }
    return ctx.db.insert("users", {
      name: "Admin",
      email: "admin@school.edu",
      role: "admin",
      isActive: true,
    });
  });
  asAdmin = t.withIdentity({ subject: `${adminId}|session` }) as TC;
});

afterEach(() => {
  vi.useRealTimers();
});

/** Drain the scheduled class-wide recompute chain. */
const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers);

/** A CA-N Math paper for Grade 4 with one question worth `marks`. */
async function createCa(n: 1 | 2 | 3, marks = 10) {
  const assessmentId = await asAdmin.mutation(
    api.assessments.createAssessment,
    {
      name: `CA-${n}`,
      assessmentNumber: n,
      semester: 1,
      subjectId: math,
      standardLevelId: grade4,
      academicYearId: year,
      totalMarks: 100,
    },
  );
  const questionId = await asAdmin.mutation(
    api.assessmentQuestions.createQuestion,
    {
      assessmentId,
      questionNumber: 1,
      marksAllocated: marks,
    },
  );
  await settle();
  return { assessmentId, questionId };
}

/** Enter one mark per student on `ca` via the grid save (`bulkMarkEntry`). */
function enterMarks(
  ca: {
    assessmentId: Id<"assessments">;
    questionId: Id<"assessmentQuestions">;
  },
  marks: number[],
) {
  return asAdmin.mutation(api.studentAssessmentAnswers.bulkMarkEntry, {
    assessmentId: ca.assessmentId,
    entries: marks.map((m, i) => ({
      studentId: students[i],
      enrollmentId: enrollments[i],
      questionId: ca.questionId,
      marksObtained: m,
    })),
  });
}

function gradeOf(i: number): Promise<Doc<"computedGrades"> | null> {
  return t.run((ctx) =>
    ctx.db
      .query("computedGrades")
      .withIndex("by_enrollment_semester", (q) =>
        q.eq("enrollmentId", enrollments[i]).eq("semester", 1),
      )
      .first(),
  );
}

const presentCount = (g: Doc<"computedGrades">) =>
  [g.ca1Percentage, g.ca2Percentage, g.ca3Percentage].filter(
    (p) => p !== undefined,
  ).length;

describe("mark entry recomputes in the same transaction", () => {
  it("bulkMarkEntry writes every student's grade and the class average follows", async () => {
    const ca1 = await createCa(1);
    await enterMarks(ca1, [10, 8, 6, 4, 2, 0]); // 100 80 60 40 20 0

    const g0 = await gradeOf(0);
    expect(g0?.weightedAverage).toBe(100);
    expect(g0?.letterGrade).toBe("A+");
    expect(g0?.standardLevelId).toBe(grade4);
    expect(g0?.expectedCaCount).toBe(1);

    const avg = await asAdmin.query(api.computedGrades.getClassAverages, {
      standardLevelId: grade4,
      academicYear: year,
      subjectId: math,
      semester: 1,
      studentId: students[1],
    });
    expect(avg.sufficient).toBe(true);
    expect(avg.gradedCount).toBe(6);
    expect(avg.classAverage).toBe(50);
    expect(avg.student?.delta).toBe(30);

    // Correct one mark: the grade and the average move with it, no manual step.
    await asAdmin.mutation(api.studentAssessmentAnswers.upsertAnswer, {
      studentId: students[5],
      enrollmentId: enrollments[5],
      assessmentId: ca1.assessmentId,
      questionId: ca1.questionId,
      marksObtained: 6,
    });
    expect((await gradeOf(5))?.weightedAverage).toBe(60);
    const avg2 = await asAdmin.query(api.computedGrades.getClassAverages, {
      standardLevelId: grade4,
      academicYear: year,
      subjectId: math,
      semester: 1,
    });
    expect(avg2.classAverage).toBe(60);
  });

  it("rejects an enrollment that is not in the assessment's class", async () => {
    const ca1 = await createCa(1);
    await expect(
      asAdmin.mutation(api.studentAssessmentAnswers.upsertAnswer, {
        studentId: students[0],
        enrollmentId: enrollments[1], // someone else's enrollment
        assessmentId: ca1.assessmentId,
        questionId: ca1.questionId,
        marksObtained: 5,
      }),
    ).rejects.toThrow("Enrollment does not match this assessment");
    expect(await gradeOf(0)).toBeNull();
  });

  it("a payload above the inline cap is recomputed by the scheduled batch", async () => {
    // 60 students > INLINE_RECOMPUTE_MAX (50) > RECOMPUTE_BATCH (25): three chunks.
    const ca1 = await createCa(1);
    const extra = await t.run(async (ctx) => {
      const out: {
        studentId: Id<"students">;
        enrollmentId: Id<"enrollments">;
      }[] = [];
      for (let i = 0; i < 60; i++) {
        const studentId = await ctx.db.insert("students", {
          studentNumber: `X-${i}`,
          createdAt: new Date(0).toISOString(),
        });
        const enrollmentId = await ctx.db.insert("enrollments", {
          studentId,
          academicYear: year,
          standardLevelId: grade4,
          enrollmentType: "new_admission",
          enrollmentDate: 0,
        });
        out.push({ studentId, enrollmentId });
      }
      return out;
    });
    await asAdmin.mutation(api.studentAssessmentAnswers.bulkMarkEntry, {
      assessmentId: ca1.assessmentId,
      entries: extra.map((e) => ({
        ...e,
        questionId: ca1.questionId,
        marksObtained: 7,
      })),
    });
    await settle();
    const rows = await t.run((ctx) =>
      ctx.db
        .query("computedGrades")
        .withIndex("by_level_year_subject_semester", (q) =>
          q
            .eq("standardLevelId", grade4)
            .eq("academicYear", year)
            .eq("subjectId", math),
        )
        .collect(),
    );
    expect(rows).toHaveLength(60);
    expect(rows.every((r) => r.weightedAverage === 70)).toBe(true);
  });
});

describe("Absent vs Unmarked (CONTEXT.md)", () => {
  it("absent is a present 0 that pulls the average down; unmarked is excluded", async () => {
    const ca1 = await createCa(1);
    const ca2 = await createCa(2);
    await enterMarks(ca1, [10, 10, 10, 10, 10, 10]);

    // Student 0: never marked on CA-2 → grade rests on CA-1 only (100%).
    const unmarked = await gradeOf(0);
    expect(unmarked?.weightedAverage).toBe(100);
    expect(unmarked?.ca2Percentage).toBeUndefined();
    expect(unmarked && presentCount(unmarked)).toBe(1);
    expect(unmarked?.expectedCaCount).toBe(2); // provisional: 1 of 2

    // Student 1: absent on CA-2 → present 0 → (100 + 0) / 2.
    await asAdmin.mutation(api.studentAssessmentAnswers.markStudentAbsent, {
      studentId: students[1],
      enrollmentId: enrollments[1],
      assessmentId: ca2.assessmentId,
    });
    const absent = await gradeOf(1);
    expect(absent?.weightedAverage).toBe(50);
    expect(absent?.ca2Percentage).toBe(0);
    expect(absent && presentCount(absent)).toBe(2); // final: 2 of 2
  });
});

describe("CA set changes refresh expectedCaCount class-wide", () => {
  it("adding a CA makes a final grade provisional; deleting it makes it final again", async () => {
    const ca1 = await createCa(1);
    await enterMarks(ca1, [10, 9, 8, 7, 6, 5]);
    let g = await gradeOf(0);
    expect(g?.expectedCaCount).toBe(1); // 1 of 1 → final

    const ca2 = await createCa(2); // settles the scheduled recompute
    g = await gradeOf(0);
    expect(g?.expectedCaCount).toBe(2); // 1 of 2 → provisional
    expect(g?.weightedAverage).toBe(100); // the number itself is unchanged

    await asAdmin.mutation(api.assessments.deleteAssessment, {
      assessmentId: ca2.assessmentId,
    });
    await settle();
    g = await gradeOf(0);
    expect(g?.expectedCaCount).toBe(1); // final again
  });

  it("deleting a CA with marks drops it from every grade, and deletes rows left with no present CA", async () => {
    const ca1 = await createCa(1);
    const ca2 = await createCa(2);
    await enterMarks(ca1, [10, 10, 10, 10, 10, 10]);
    // Only students 0–4 sit CA-2; student 5 has CA-1 only.
    await asAdmin.mutation(api.studentAssessmentAnswers.bulkMarkEntry, {
      assessmentId: ca2.assessmentId,
      entries: students.slice(0, 5).map((studentId, i) => ({
        studentId,
        enrollmentId: enrollments[i],
        questionId: ca2.questionId,
        marksObtained: 0,
      })),
    });
    expect((await gradeOf(0))?.weightedAverage).toBe(50); // (100 + 0) / 2

    // Remove CA-1 → everyone is graded on CA-2 alone; student 5 is now ungraded.
    await asAdmin.mutation(api.assessments.deleteAssessment, {
      assessmentId: ca1.assessmentId,
    });
    await settle();
    const g0 = await gradeOf(0);
    expect(g0?.weightedAverage).toBe(0);
    expect(g0?.ca1Percentage).toBeUndefined();
    expect(g0?.expectedCaCount).toBe(1);
    expect(await gradeOf(5)).toBeNull();
  });

  it("deactivating a CA behaves like removing it for the grade", async () => {
    const ca1 = await createCa(1);
    const ca2 = await createCa(2);
    await enterMarks(ca1, [10, 10, 10, 10, 10, 10]);
    await enterMarks(ca2, [0, 0, 0, 0, 0, 0]);
    expect((await gradeOf(0))?.weightedAverage).toBe(50);
    await asAdmin.mutation(api.assessments.deactivateAssessment, {
      assessmentId: ca2.assessmentId,
    });
    await settle();
    expect((await gradeOf(0))?.weightedAverage).toBe(100);
  });

  it("re-marking a question changes the denominator for the whole class", async () => {
    const ca1 = await createCa(1, 10);
    await enterMarks(ca1, [5, 5, 5, 5, 5, 5]); // 50%
    await asAdmin.mutation(api.assessmentQuestions.updateQuestion, {
      questionId: ca1.questionId,
      marksAllocated: 20,
    });
    await settle();
    expect((await gradeOf(3))?.weightedAverage).toBe(25);
    expect((await gradeOf(3))?.ca1TotalMarks).toBe(20);
  });

  it("the batch skips a poison row and still finishes the class", async () => {
    const ca1 = await createCa(1);
    await enterMarks(ca1, [10, 10, 10, 10, 10, 10]);
    // Orphan student 0's row: its enrollment disappears.
    await t.run((ctx) => ctx.db.delete(enrollments[0]));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await asAdmin.mutation(api.assessmentQuestions.updateQuestion, {
      questionId: ca1.questionId,
      marksAllocated: 20,
    });
    await settle();
    warn.mockRestore();
    expect((await gradeOf(1))?.weightedAverage).toBe(50);
    expect((await gradeOf(5))?.weightedAverage).toBe(50);
  });
});

describe("getClassPositions final/provisional gate", () => {
  const positions = (i: number) =>
    asAdmin.query(api.computedGrades.getClassPositions, {
      standardLevelId: grade4,
      academicYear: year,
      semester: 1,
      studentId: students[i],
    });

  it("ranks on the stored expectedCaCount, falling back to a live count for legacy rows", async () => {
    const ca1 = await createCa(1);
    await enterMarks(ca1, [10, 9, 8, 7, 6, 5]);
    let p = await positions(2);
    expect(p.bySubject[0].provisional).toBe(false);
    expect(p.bySubject[0].position).toEqual({ rank: 3, outOf: 6 });
    expect(p.overall).toEqual({ rank: 3, outOf: 6 });

    // A second CA appears → every row is provisional (1 of 2) → nothing ranked.
    const ca2 = await createCa(2);
    p = await positions(2);
    expect(p.bySubject[0].provisional).toBe(true);
    expect(p.bySubject[0].position).toBeNull();
    expect(p.overallSuppressedReason).toBe("provisional");

    // Legacy rows (pre-migration, no expectedCaCount) use the live CA count.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("computedGrades").collect();
      for (const r of rows) {
        const { _id, _creationTime, expectedCaCount: _drop, ...rest } = r;
        await ctx.db.replace(_id, rest);
      }
    });
    p = await positions(2);
    expect(p.bySubject[0].provisional).toBe(true); // live count = 2, present = 1
    await asAdmin.mutation(api.assessments.deleteAssessment, {
      assessmentId: ca2.assessmentId,
    });
    // The delete schedules a recompute that rewrites expectedCaCount; before it
    // runs, the legacy rows must already rank on the live count (now 1).
    p = await positions(2);
    expect(p.bySubject[0].provisional).toBe(false);
    expect(p.overall).toEqual({ rank: 3, outOf: 6 });
    await settle();
    expect((await gradeOf(2))?.expectedCaCount).toBe(1);
  });
});

describe("placement amend keeps the denormalised level in step", () => {
  it("moving a student to another level moves their grade rows' standardLevelId", async () => {
    const ca1 = await createCa(1);
    await enterMarks(ca1, [10, 10, 10, 10, 10, 10]);
    const campus = await t.run((ctx) =>
      ctx.db.insert("campuses", { name: "Campus 01", address: "-" }),
    );
    await asAdmin.mutation(api.students.updateStudent, {
      studentId: students[0],
      placement: { standardLevelId: grade5, campus },
    });
    expect((await gradeOf(0))?.standardLevelId).toBe(grade5);
    // The old class no longer counts them.
    const avg = await asAdmin.query(api.computedGrades.getClassAverages, {
      standardLevelId: grade4,
      academicYear: year,
      subjectId: math,
      semester: 1,
    });
    expect(avg.gradedCount).toBe(5);
  });
});

describe("repair migration", () => {
  it("recomputeEnrollmentGrades creates rows for marks that were never computed", async () => {
    const ca1 = await createCa(1);
    await enterMarks(ca1, [10, 10, 10, 10, 10, 10]);
    // Simulate today's stale state: the row for student 2 is missing.
    const row = await gradeOf(2);
    if (!row) throw new Error("fixture: row expected");
    await t.run((ctx) => ctx.db.delete(row._id));
    expect(await gradeOf(2)).toBeNull();

    await asAdmin.mutation(internal.migrations.runRecomputeAllGrades, {});
    await settle();
    expect((await gradeOf(2))?.weightedAverage).toBe(100);
  });
});
