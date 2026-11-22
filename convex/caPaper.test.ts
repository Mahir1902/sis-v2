/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

/**
 * The CA Paper module (`lib/caPaper.ts`): what makes an Assessment's questions
 * and marks valid (ADR-0004; architecture review 2026-11-21, candidate 2).
 */

const modules = import.meta.glob("./**/*.*s");
type TC = TestConvex<typeof schema>;

let t: TC;
let asAdmin: TC;
let asTeacher: TC;
let grade4: Id<"standardLevels">;
let year: Id<"academicYears">;
let math: Id<"subjects">;
let student: Id<"students">;
let enrollment: Id<"enrollments">;

beforeEach(async () => {
  vi.useFakeTimers();
  t = convexTest(schema, modules);
  const users = await t.run(async (ctx) => {
    grade4 = await ctx.db.insert("standardLevels", {
      name: "Grade 4",
      code: "04",
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
    student = await ctx.db.insert("students", {
      studentNumber: "S-1",
      studentFullName: "Rafi",
      status: "active",
      createdAt: new Date(0).toISOString(),
    });
    enrollment = await ctx.db.insert("enrollments", {
      studentId: student,
      academicYear: year,
      standardLevelId: grade4,
      enrollmentType: "new_admission",
      enrollmentDate: 0,
    });
    const user = (role: "admin" | "teacher") =>
      ctx.db.insert("users", {
        name: role,
        email: `${role}@school.edu`,
        role,
        isActive: true,
      });
    return { admin: await user("admin"), teacher: await user("teacher") };
  });
  asAdmin = t.withIdentity({ subject: `${users.admin}|session` }) as TC;
  asTeacher = t.withIdentity({ subject: `${users.teacher}|session` }) as TC;
});

afterEach(() => {
  vi.useRealTimers();
});

/** Drain the scheduled class-wide recompute chain. */
const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers);

const createCa = (n: 1 | 2 | 3, totalMarks = 100) =>
  asAdmin.mutation(api.assessments.createAssessment, {
    name: `CA-${n}`,
    assessmentNumber: n,
    semester: 1,
    subjectId: math,
    standardLevelId: grade4,
    academicYearId: year,
    totalMarks,
  });

const addQuestion = (assessmentId: Id<"assessments">, marksAllocated: number) =>
  asAdmin.mutation(api.assessmentQuestions.createQuestion, {
    assessmentId,
    questionNumber: 1,
    marksAllocated,
  });

const mark = (
  assessmentId: Id<"assessments">,
  questionId: Id<"assessmentQuestions">,
  marksObtained: number,
  isAbsent?: boolean,
) => ({
  assessmentId,
  entries: [
    {
      studentId: student,
      enrollmentId: enrollment,
      questionId,
      marksObtained,
      isAbsent,
    },
  ],
});

const grades = () => t.run((ctx) => ctx.db.query("computedGrades").collect());
const answers = () =>
  t.run((ctx) => ctx.db.query("studentAssessmentAnswers").collect());

it("regression: a teacher cannot store 55 on a 10-mark question (the 550% A+ probe)", async () => {
  const ca = await createCa(1);
  const q = await addQuestion(ca, 10);

  await expect(
    asTeacher.mutation(
      api.studentAssessmentAnswers.bulkMarkEntry,
      mark(ca, q, 55),
    ),
  ).rejects.toThrow(/between 0 and 10/);
  await expect(
    asTeacher.mutation(api.studentAssessmentAnswers.upsertAnswer, {
      studentId: student,
      enrollmentId: enrollment,
      assessmentId: ca,
      questionId: q,
      marksObtained: -1,
    }),
  ).rejects.toThrow(/between 0 and 10/);
  expect(await answers()).toEqual([]);
  expect(await grades()).toEqual([]);

  // The full allocation is still a valid mark: 100%, not 550%.
  await asTeacher.mutation(
    api.studentAssessmentAnswers.bulkMarkEntry,
    mark(ca, q, 10),
  );
  expect(await grades()).toMatchObject([
    { weightedAverage: 100, letterGrade: "A+" },
  ]);
});

it("rejects a mark on a question from another paper", async () => {
  const ca1 = await createCa(1);
  const ca2 = await createCa(2);
  await addQuestion(ca1, 10);
  const otherPapersQuestion = await addQuestion(ca2, 10);

  await expect(
    asAdmin.mutation(
      api.studentAssessmentAnswers.bulkMarkEntry,
      mark(ca1, otherPapersQuestion, 5),
    ),
  ).rejects.toThrow(/not on this assessment/);
  expect(await answers()).toEqual([]);
});

it("stores 0 for an Absent student whatever mark is sent", async () => {
  const ca = await createCa(1);
  const q = await addQuestion(ca, 10);

  await asAdmin.mutation(
    api.studentAssessmentAnswers.bulkMarkEntry,
    mark(ca, q, 9, true),
  );
  expect(await answers()).toMatchObject([{ marksObtained: 0, isAbsent: true }]);
  expect(await grades()).toMatchObject([{ weightedAverage: 0 }]);
});

it("rejects a question worth 0 or fewer marks, and questions past the paper total", async () => {
  const ca = await createCa(1, 20);
  await expect(addQuestion(ca, 0)).rejects.toThrow(/more than 0 marks/);
  await expect(addQuestion(ca, -5)).rejects.toThrow(/more than 0 marks/);

  const q = await addQuestion(ca, 15);
  await expect(addQuestion(ca, 6)).rejects.toThrow(
    /more than the assessment total of 20/,
  );
  await expect(
    asAdmin.mutation(api.assessmentQuestions.bulkCreateQuestions, {
      assessmentId: ca,
      questions: [
        { questionNumber: 2, marksAllocated: 3 },
        { questionNumber: 3, marksAllocated: 3 },
      ],
    }),
  ).rejects.toThrow(/more than the assessment total of 20/);
  await expect(
    asAdmin.mutation(api.assessmentQuestions.updateQuestion, {
      questionId: q,
      marksAllocated: 21,
    }),
  ).rejects.toThrow(/more than the assessment total of 20/);
  await expect(
    asAdmin.mutation(api.assessmentQuestions.updateQuestion, {
      questionId: q,
      marksAllocated: 0,
    }),
  ).rejects.toThrow(/more than 0 marks/);
  // The reverse direction: the paper total cannot drop below the questions.
  await expect(
    asAdmin.mutation(api.assessments.updateAssessment, {
      assessmentId: ca,
      totalMarks: 14,
    }),
  ).rejects.toThrow(/more than the assessment total of 14/);
});

it("refuses lowering an allocation below marks already entered", async () => {
  const ca = await createCa(1);
  const q = await addQuestion(ca, 10);
  await asAdmin.mutation(
    api.studentAssessmentAnswers.bulkMarkEntry,
    mark(ca, q, 8),
  );

  await expect(
    asAdmin.mutation(api.assessmentQuestions.updateQuestion, {
      questionId: q,
      marksAllocated: 7,
    }),
  ).rejects.toThrow(/already has 8 marks/);

  // Down to the highest entered mark is fine: 8/8 = 100%, never above.
  await asAdmin.mutation(api.assessmentQuestions.updateQuestion, {
    questionId: q,
    marksAllocated: 8,
  });
  await settle();
  expect(await grades()).toMatchObject([{ weightedAverage: 100 }]);
});

it("recreates a CA after it was deactivated, and still blocks an active duplicate", async () => {
  const first = await createCa(1);
  await expect(createCa(1)).rejects.toThrow(/CA-1 already exists/);

  await asAdmin.mutation(api.assessments.deactivateAssessment, {
    assessmentId: first,
  });
  const second = await createCa(1);
  expect(second).not.toEqual(first);
  await expect(createCa(1)).rejects.toThrow(/CA-1 already exists/);

  // The bulk path shares the rule: CA-1 is taken, so nothing is created.
  await expect(
    asAdmin.mutation(api.assessments.bulkCreateAssessments, {
      semester: 1,
      subjectId: math,
      standardLevelId: grade4,
      academicYearId: year,
      totalMarks: 100,
    }),
  ).rejects.toThrow(/CA-1 already exists/);
});

it("deleting a question recomputes the grade of a student who had marks on the paper", async () => {
  const ca = await createCa(1);
  const q1 = await addQuestion(ca, 10);
  const q2 = await addQuestion(ca, 10);
  await asAdmin.mutation(api.studentAssessmentAnswers.bulkMarkEntry, {
    assessmentId: ca,
    entries: [q1, q2].map((questionId, i) => ({
      studentId: student,
      enrollmentId: enrollment,
      questionId,
      marksObtained: i === 0 ? 10 : 0,
    })),
  });
  expect(await grades()).toMatchObject([{ weightedAverage: 50 }]);

  await asAdmin.mutation(api.assessmentQuestions.deleteQuestion, {
    questionId: q2,
  });
  await settle();
  expect(await answers()).toHaveLength(1);
  expect(await grades()).toMatchObject([{ weightedAverage: 100 }]);
});

it("exposes the real CA total: the sum of the question marks, not the paper target", async () => {
  const ca = await createCa(1, 100);
  await addQuestion(ca, 25);
  await addQuestion(ca, 15);

  const paper = await asAdmin.query(api.assessments.getAssessmentById, {
    assessmentId: ca,
  });
  expect(paper).toMatchObject({ totalMarks: 100, questionTotal: 40 });
});
