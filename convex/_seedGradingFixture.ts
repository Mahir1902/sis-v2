import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { recomputeGrade } from "./computedGrades";

/**
 * DISPOSABLE DEV FIXTURE — do NOT commit to `seed.ts`, do NOT run in prod.
 *
 * Populates one coherent "Class" (KG-2 + academic year 2025-2026 + Campus 01,
 * semester 1) of computed grades so the Academic History analytics tab (Phase C)
 * can be visually verified. KG-2 is used because the dev DB's Grade 5 class is
 * already polluted by earlier test-seed assessments; KG-2 / 2025-2026 is empty,
 * so the fixture owns the whole (subject, level, year, semester) space and no
 * shared data is mutated. Every student/enrollment/assessment/answer is inserted
 * directly via `ctx.db.insert` (this is an internalMutation, so it bypasses
 * `requireRole` — fine, it is not reachable from the client), then the EXPORTED
 * `recomputeGrade` helper is called per (student, subject) to write the real
 * `computedGrades` rows using the same math the app uses.
 *
 * Shape it produces (7 students, prefixed `FIX-` so they are identifiable/removable):
 *  - Mathematics: CA-1/2/3 for all 7, distinct per-student totals (A+ → F spread).
 *  - English:     CA-1/2/3 for all 7, a DIFFERENT ordering so ranks differ from Math.
 *  - Science:     CA-1 only, student 7 only → student 7's Science grade is PROVISIONAL
 *                 and no other student has a Science grade.
 *
 * Reachable analytics states:
 *  - Students 1–6 are term-complete (Math + English both final, no Science) → overall
 *    Class Position fires (6 term-complete peers ≥ MIN_CLASS_PEERS=5), per-subject
 *    Math/English positions fire, deltas + per-CA baselines populate. S3 is rank-1 overall.
 *  - Student 7 has Math + English final PLUS a provisional Science → overall suppressed
 *    with reason "provisional"; the Science row shows the provisional/suppressed state
 *    while Math/English rows still show ranks.
 *
 * Idempotent: pass `{ reset: true }` to wipe all `FIX-` students and everything they
 * own (enrollments, assessments, questions, answers, computedGrades) before re-seeding.
 * Without `reset`, a second run detects an existing `FIX-` student and returns the
 * already-seeded IDs untouched.
 *
 * Run: `npx convex run _seedGradingFixture:seedGradingFixture`
 * Reset + reseed: `npx convex run _seedGradingFixture:seedGradingFixture '{"reset": true}'`
 */

const FIX_PREFIX = "FIX-";
const SEMESTER = 1 as const;

/** Human names for the 7 fixture students, index 0 = student 1. */
const STUDENT_NAMES = [
  "Aisha Rahman",
  "Bilal Karim",
  "Chandni Das",
  "Daniyal Hossain",
  "Elham Chowdhury",
  "Farhan Islam",
  "Gulnaz Akter",
] as const;

/**
 * Per-student CA totals (each CA is out of 100). Index 0 = student 1.
 * Math is ordered high→low; English uses a different ordering so ranks differ.
 * Science is CA-1 only for student 7.
 *
 * Resulting subject averages (mean of present CAs):
 *   Math:    S1 92.33(A+) S2 85.00(A) S3 78.00(B) S4 70.00(B) S5 63.00(C) S6 55.00(D) S7 48.00(F)
 *   English: S1 76.00(B)  S2 68.00(C) S3 94.00(A+) S4 82.00(A) S5 58.00(D) S6 88.00(A) S7 50.00(D)
 * Overall term average (Math+English) for term-complete S1–S6:
 *   S1 84.17 · S2 76.50 · S3 86.00(rank 1) · S4 76.00 · S5 60.50 · S6 71.50 — all distinct.
 */
const MATH_MARKS: ReadonlyArray<[number, number, number]> = [
  [95, 92, 90],
  [88, 85, 82],
  [80, 78, 76],
  [72, 70, 68],
  [65, 63, 61],
  [58, 55, 52],
  [50, 48, 46],
];

const ENGLISH_MARKS: ReadonlyArray<[number, number, number]> = [
  [78, 76, 74],
  [70, 68, 66],
  [96, 94, 92],
  [84, 82, 80],
  [60, 58, 56],
  [90, 88, 86],
  [52, 50, 48],
];

// Science: only student 7 (index 6), only CA-1. Everyone else ungraded in Science.
const SCIENCE_S7_CA1 = 61;

/**
 * Look up a reference row by its `name`, throwing a clear dev error if absent.
 * Restricted to the four reference tables whose docs all carry a `name: string`,
 * so `r.name` needs no cast (Convex's stricter tsc rejects casting the doc union).
 */
async function requireRef<
  T extends "standardLevels" | "academicYears" | "campuses" | "subjects",
>(ctx: MutationCtx, table: T, name: string): Promise<Id<T>> {
  const rows = await ctx.db.query(table).collect();
  const match = rows.find((r) => r.name === name);
  if (!match) {
    throw new Error(
      `Fixture reference "${name}" not found in "${table}". Run seed:seedReferenceData first.`,
    );
  }
  return match._id as Id<T>;
}

/**
 * Look up a standard level by its stable `code` (e.g. "05" = Grade 5). The dev
 * DB's level `name` is the spelled-out "Grade Five", not "Grade 5", so matching
 * on `code` is the reliable key regardless of naming.
 */
async function requireLevelByCode(
  ctx: MutationCtx,
  code: string,
): Promise<Id<"standardLevels">> {
  const rows = await ctx.db.query("standardLevels").collect();
  const match = rows.find((r) => r.code === code);
  if (!match) {
    throw new Error(
      `Fixture reference: standard level code "${code}" not found. Run seed:seedReferenceData first.`,
    );
  }
  return match._id;
}

/** Delete every `FIX-` student and all rows that reference it. */
async function resetFixture(ctx: MutationCtx): Promise<number> {
  const students = (await ctx.db.query("students").collect()).filter((s) =>
    s.studentNumber.startsWith(FIX_PREFIX),
  );
  let deleted = 0;
  for (const student of students) {
    // Enrollments for this student.
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student_academic_year", (q) =>
        q.eq("studentId", student._id),
      )
      .collect();

    // Answers + computed grades keyed on student.
    const answers = await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_student_assessment", (q) => q.eq("studentId", student._id))
      .collect();
    const grades = await ctx.db
      .query("computedGrades")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .collect();

    await Promise.all([
      ...answers.map((a) => ctx.db.delete(a._id)),
      ...grades.map((g) => ctx.db.delete(g._id)),
    ]);
    await Promise.all(enrollments.map((e) => ctx.db.delete(e._id)));
    await ctx.db.delete(student._id);
    deleted += 1;
  }

  // Fixture assessments + their questions (tagged by the FIX- name prefix).
  const assessments = (await ctx.db.query("assessments").collect()).filter(
    (a) => a.name.startsWith(FIX_PREFIX),
  );
  for (const assessment of assessments) {
    const questions = await ctx.db
      .query("assessmentQuestions")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", assessment._id))
      .collect();
    await Promise.all(questions.map((q) => ctx.db.delete(q._id)));
    await ctx.db.delete(assessment._id);
  }
  return deleted;
}

/** Build the required `students` insert payload with valid dummy values. */
function studentPayload(
  index: number,
  refs: {
    standardLevelId: Id<"standardLevels">;
    academicYearId: Id<"academicYears">;
    campusId: Id<"campuses">;
  },
) {
  const name = STUDENT_NAMES[index];
  const n = index + 1;
  const now = Date.now();
  return {
    studentNumber: `${FIX_PREFIX}KG2-${String(n).padStart(3, "0")}`,
    studentFullName: name,
    gender: (index % 2 === 0 ? "Female" : "Male") as "Male" | "Female",
    dateOfBirth: new Date(2015, index, 5).getTime(),
    placeOfBirth: "Dhaka",
    citizenship: "Bangladeshi",
    religion: "Islam",
    bloodGroup: "O+",
    birthCertificateNumber: `BC-FIX-${String(n).padStart(4, "0")}`,
    standardLevel: refs.standardLevelId,
    academicYear: refs.academicYearId,
    campus: refs.campusId,
    admissionDate: now,
    classStartDate: now,
    presentAddress: `House ${n}, Road ${n}, Dhaka`,
    healthIssue: { hasHealthIssues: false },
    fatherName: `Father of ${name}`,
    fatherOccupation: "Engineer",
    fatherNidNumber: `NID-F-${String(n).padStart(6, "0")}`,
    fatherPhoneNumber: `01700000${String(n).padStart(3, "0")}`,
    motherName: `Mother of ${name}`,
    motherOccupation: "Teacher",
    motherNidNumber: `NID-M-${String(n).padStart(6, "0")}`,
    motherPhoneNumber: `01800000${String(n).padStart(3, "0")}`,
    guardianName: `Father of ${name}`,
    guardianRelation: "Father",
    guardianNidNumber: `NID-F-${String(n).padStart(6, "0")}`,
    guardianPhoneNumber: `01700000${String(n).padStart(3, "0")}`,
    primaryBillingContact: "father" as const,
    familyAnnualIncome: "500000",
    status: "active" as const,
    consultantName: "Fixture Consultant",
    createdAt: new Date(now).toISOString(),
  };
}

/**
 * Create one CA assessment (out of 100) for a subject with a single 100-mark
 * question, and return both ids so answers can reference the question.
 */
async function createCaAssessment(
  ctx: MutationCtx,
  args: {
    subjectId: Id<"subjects">;
    subjectName: string;
    caNumber: 1 | 2 | 3;
    standardLevelId: Id<"standardLevels">;
    academicYearId: Id<"academicYears">;
  },
): Promise<{
  assessmentId: Id<"assessments">;
  questionId: Id<"assessmentQuestions">;
}> {
  const assessmentId = await ctx.db.insert("assessments", {
    name: `${FIX_PREFIX}${args.subjectName} CA-${args.caNumber}`,
    assessmentNumber: args.caNumber,
    semester: SEMESTER,
    subjectId: args.subjectId,
    standardLevelId: args.standardLevelId,
    academicYearId: args.academicYearId,
    totalMarks: 100,
    isActive: true,
    createdAt: Date.now(),
  });
  const questionId = await ctx.db.insert("assessmentQuestions", {
    assessmentId,
    questionNumber: 1,
    questionText: "Total",
    marksAllocated: 100,
    displayOrder: 1,
    isActive: true,
    createdAt: Date.now(),
  });
  return { assessmentId, questionId };
}

export const seedGradingFixture = internalMutation({
  args: { reset: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    // ── Idempotency ────────────────────────────────────────────────────────
    if (args.reset) {
      await resetFixture(ctx);
    } else {
      const existing = (await ctx.db.query("students").collect()).find((s) =>
        s.studentNumber.startsWith(FIX_PREFIX),
      );
      if (existing) {
        return {
          status: "already_seeded" as const,
          note: 'FIX- students already exist. Re-run with {"reset": true} to rebuild.',
        };
      }
    }

    // ── Reference lookups (never created here) ───────────────────────────────
    // KG-2 (code "KG2") is used instead of Grade 5 because the dev DB's Grade 5 /
    // 2025-2026 class is already occupied by earlier test-seed assessments (with
    // other students' answers) on all three subjects in both semesters. Those
    // strays would inflate the live "expected CA" count so every fixture grade
    // reads as provisional (positions + overall rank suppressed). KG-2 / 2025-2026
    // is verified empty, so our 3 CAs per subject are the ONLY live assessments —
    // final-gating fires and no shared data is mutated.
    const standardLevelId = await requireLevelByCode(ctx, "KG2"); // KG-2
    const academicYearId = await requireRef(ctx, "academicYears", "2025-2026");
    const campusId = await requireRef(ctx, "campuses", "Campus 01");
    const mathId = await requireRef(ctx, "subjects", "Mathematics");
    const englishId = await requireRef(ctx, "subjects", "English");
    const scienceId = await requireRef(ctx, "subjects", "Science");

    const refs = { standardLevelId, academicYearId, campusId };

    // ── Students + enrollments (7) ──────────────────────────────────────────
    const studentIds = await Promise.all(
      STUDENT_NAMES.map((_, i) =>
        ctx.db.insert("students", studentPayload(i, refs)),
      ),
    );
    const enrollmentIds = await Promise.all(
      studentIds.map((studentId) =>
        ctx.db.insert("enrollments", {
          studentId,
          academicYear: academicYearId,
          standardLevelId,
          campus: campusId,
          enrollmentType: "regular",
          enrollmentDate: Date.now(),
          status: "active",
          // NO exitDate → current/active enrollment (schema-improvement rule #9).
        }),
      ),
    );

    // ── Assessments: Math CA-1/2/3, English CA-1/2/3, Science CA-1/2/3 ───────
    const [mathCas, englishCas, scienceCas] = await Promise.all([
      Promise.all(
        ([1, 2, 3] as const).map((ca) =>
          createCaAssessment(ctx, {
            subjectId: mathId,
            subjectName: "Mathematics",
            caNumber: ca,
            standardLevelId,
            academicYearId,
          }),
        ),
      ),
      Promise.all(
        ([1, 2, 3] as const).map((ca) =>
          createCaAssessment(ctx, {
            subjectId: englishId,
            subjectName: "English",
            caNumber: ca,
            standardLevelId,
            academicYearId,
          }),
        ),
      ),
      Promise.all(
        ([1, 2, 3] as const).map((ca) =>
          createCaAssessment(ctx, {
            subjectId: scienceId,
            subjectName: "Science",
            caNumber: ca,
            standardLevelId,
            academicYearId,
          }),
        ),
      ),
    ]);

    // ── Answers ──────────────────────────────────────────────────────────────
    const answerInserts: Promise<Id<"studentAssessmentAnswers">>[] = [];
    const insertAnswer = (
      studentIndex: number,
      ca: {
        assessmentId: Id<"assessments">;
        questionId: Id<"assessmentQuestions">;
      },
      marks: number,
    ) => {
      answerInserts.push(
        ctx.db.insert("studentAssessmentAnswers", {
          studentId: studentIds[studentIndex],
          enrollmentId: enrollmentIds[studentIndex],
          assessmentId: ca.assessmentId,
          questionId: ca.questionId,
          marksObtained: marks,
          enteredAt: Date.now(),
        }),
      );
    };

    // Math + English: all 7 students, all 3 CAs.
    for (let s = 0; s < STUDENT_NAMES.length; s++) {
      for (let ca = 0; ca < 3; ca++) {
        insertAnswer(s, mathCas[ca], MATH_MARKS[s][ca]);
        insertAnswer(s, englishCas[ca], ENGLISH_MARKS[s][ca]);
      }
    }
    // Science: student 7 (index 6), CA-1 only → provisional.
    insertAnswer(6, scienceCas[0], SCIENCE_S7_CA1);

    await Promise.all(answerInserts);

    // ── Compute grades: recomputeGrade per (student, subject) ─────────────────
    // Math + English for all 7 students; Science only for student 7 (the only one
    // with any Science mark — others produce no row, which is correct).
    const computeResults = await Promise.all([
      ...studentIds.flatMap((studentId, i) =>
        [mathId, englishId].map((subjectId) =>
          recomputeGrade(ctx, {
            studentId,
            enrollmentId: enrollmentIds[i],
            subjectId,
            semester: SEMESTER,
          }),
        ),
      ),
      recomputeGrade(ctx, {
        studentId: studentIds[6],
        enrollmentId: enrollmentIds[6],
        subjectId: scienceId,
        semester: SEMESTER,
      }),
    ]);
    const computedGradesCreated = computeResults.filter(
      (id) => id !== null,
    ).length;

    // ── Structured report for the frontend verifier ──────────────────────────
    // S3 (index 2) is rank-1 overall (86.00); S7 (index 6) is the provisional demo.
    return {
      status: "seeded" as const,
      primaryDemoStudentId: studentIds[2],
      primaryDemoStudentName: STUDENT_NAMES[2],
      primaryDemoExpectedOverallRank: `1 of 6`,
      provisionalDemoStudentId: studentIds[6],
      provisionalDemoStudentName: STUDENT_NAMES[6],
      standardLevelId,
      academicYearId,
      campusId,
      semester: SEMESTER,
      subjects: {
        mathematics: mathId,
        english: englishId,
        science: scienceId,
      },
      studentIds,
      enrollmentIds,
      counts: {
        studentsCreated: studentIds.length,
        enrollmentsCreated: enrollmentIds.length,
        assessmentsCreated:
          mathCas.length + englishCas.length + scienceCas.length,
        answersCreated: answerInserts.length,
        computedGradesCreated,
      },
      rerunCommand:
        "npx convex run _seedGradingFixture:seedGradingFixture '{\"reset\": true}'",
    };
  },
});
