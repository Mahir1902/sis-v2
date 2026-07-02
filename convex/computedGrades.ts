import { v } from "convex/values";
import {
  type CaInput,
  computeRenormalizedGrade,
} from "../lib/gradeComputation";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";

/**
 * Recompute one student's grade for a (subject, semester) under the ADR-0004
 * renormalized model, and write the result.
 *
 * Present CA = the student has ≥1 answer row for the assessment AND the
 * assessment has a positive question-mark total. The grade is the renormalized
 * (equal-weight ⇒ mean) average of the present CAs' percentages; the pure math
 * lives in `lib/gradeComputation.ts`. When NO CA is present the subject is
 * ungraded: no row is written, and any stale row is deleted so an old "0 / F"
 * from the previous math cannot linger.
 *
 * NOT auto-triggered by mark entry — the manual "Compute Grades" action is the
 * only trigger (unchanged from the previous design). Callers that need fresh
 * grades after entering marks must run compute.
 *
 * Shared by the public `computeGradesForStudent` mutation and the A.4 backfill
 * migration, so it takes a bare `MutationCtx` and does no permission check —
 * the public entry point is responsible for `requireRole`.
 */
export async function recomputeGrade(
  ctx: MutationCtx,
  args: {
    studentId: Id<"students">;
    enrollmentId: Id<"enrollments">;
    subjectId: Id<"subjects">;
    semester: 1 | 2;
  },
): Promise<Id<"computedGrades"> | null> {
  const enrollment = await ctx.db.get(args.enrollmentId);
  if (!enrollment) throw new Error("Enrollment not found");

  // Active assessments for this subject at this level + year + semester (≤ 3).
  const assessments = await ctx.db
    .query("assessments")
    .withIndex("by_subject_semester", (q) =>
      q.eq("subjectId", args.subjectId).eq("semester", args.semester),
    )
    .filter((q) =>
      q.and(
        q.eq(q.field("standardLevelId"), enrollment.standardLevelId),
        q.eq(q.field("academicYearId"), enrollment.academicYear),
        q.eq(q.field("isActive"), true),
      ),
    )
    .collect();

  // Any existing row for this (enrollment, subject, semester). We replace it
  // (never patch — Convex drops `undefined` keys, so patching would leave a
  // stale caN percentage when a CA goes present → unmarked), or delete it when
  // the subject is now ungraded.
  const existing = await ctx.db
    .query("computedGrades")
    .withIndex("by_enrollment_semester", (q) =>
      q.eq("enrollmentId", args.enrollmentId).eq("semester", args.semester),
    )
    .filter((q) => q.eq(q.field("subjectId"), args.subjectId))
    .first();

  // One CaInput per assessment: denominator = Σ question `marksAllocated`,
  // presence + marks from the student's answer rows. Batched to avoid N+1.
  const cas: CaInput[] = await Promise.all(
    assessments.map(async (assessment) => {
      const [questions, answers] = await Promise.all([
        ctx.db
          .query("assessmentQuestions")
          .withIndex("by_assessment", (q) =>
            q.eq("assessmentId", assessment._id),
          )
          .collect(),
        ctx.db
          .query("studentAssessmentAnswers")
          .withIndex("by_student_assessment", (q) =>
            q
              .eq("studentId", args.studentId)
              .eq("assessmentId", assessment._id),
          )
          .collect(),
      ]);
      return {
        assessmentNumber: assessment.assessmentNumber,
        hasAnswers: answers.length > 0,
        marksObtained: answers.reduce((sum, a) => sum + a.marksObtained, 0),
        marksAllocated: questions.reduce((sum, q) => sum + q.marksAllocated, 0),
      };
    }),
  );

  const result = computeRenormalizedGrade(cas);

  // Zero present CAs → ungraded. Delete a stale row, write nothing new.
  if (!result) {
    if (existing) await ctx.db.delete(existing._id);
    return null;
  }

  const gradeData = {
    studentId: args.studentId,
    enrollmentId: args.enrollmentId,
    // Denormalised from the enrollment so class-level analytics can index by
    // level + year + subject + semester (see schema). Immutable for this grade.
    standardLevelId: enrollment.standardLevelId,
    academicYear: enrollment.academicYear,
    subjectId: args.subjectId,
    semester: args.semester,
    ca1Marks: result.ca1?.marks,
    ca1Percentage: result.ca1?.percentage,
    ca1TotalMarks: result.ca1?.totalMarks,
    ca2Marks: result.ca2?.marks,
    ca2Percentage: result.ca2?.percentage,
    ca2TotalMarks: result.ca2?.totalMarks,
    ca3Marks: result.ca3?.marks,
    ca3Percentage: result.ca3?.percentage,
    ca3TotalMarks: result.ca3?.totalMarks,
    weightedAverage: result.weightedAverage,
    letterGrade: result.letterGrade,
    totalMarksObtained: result.totalMarksObtained,
    totalPossibleMarks: result.totalPossibleMarks,
    // Provisional-grade signal (A.2): how many CAs the subject runs this term,
    // snapshotted at compute time. present count (derived from which caX
    // percentage fields are set) < expectedCaCount ⇒ provisional. NOTE: this is
    // a snapshot — if assessments are added later it can go stale until the
    // next recompute, so the authoritative final/provisional *gate* (Phase C)
    // must reconcile against a live `assessments.length`, not this stored value.
    expectedCaCount: assessments.length,
    computedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.replace(existing._id, gradeData);
    return existing._id;
  }
  return await ctx.db.insert("computedGrades", gradeData);
}

/**
 * Compute (or clear) one student's grade for a subject/semester. Thin wrapper
 * over `recomputeGrade` that enforces the role gate and writes the audit trail.
 */
export const computeGradesForStudent = mutation({
  args: {
    studentId: v.id("students"),
    enrollmentId: v.id("enrollments"),
    subjectId: v.id("subjects"),
    semester: v.union(v.literal(1), v.literal(2)),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "teacher"]);
    const gradeId = await recomputeGrade(ctx, args);

    await logAudit(ctx, {
      user,
      action: gradeId ? "create" : "delete",
      entityType: "computedGrades",
      entityId: gradeId ?? args.enrollmentId,
      description: gradeId
        ? "Computed grades for student"
        : "Cleared grade — subject has no present CAs",
    });

    return gradeId;
  },
});

/** Get all computed grades for a student, grouped by enrollment+semester. */
export const getComputedGradesByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const grades = await ctx.db
      .query("computedGrades")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    return await Promise.all(
      grades.map(async (g) => ({
        ...g,
        subjectDoc: await ctx.db.get(g.subjectId),
      })),
    );
  },
});

/** Get computed grades for one enrollment+semester. */
export const getGradesByEnrollmentSemester = query({
  args: {
    enrollmentId: v.id("enrollments"),
    semester: v.union(v.literal(1), v.literal(2)),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const grades = await ctx.db
      .query("computedGrades")
      .withIndex("by_enrollment_semester", (q) =>
        q.eq("enrollmentId", args.enrollmentId).eq("semester", args.semester),
      )
      .collect();

    return await Promise.all(
      grades.map(async (g) => ({
        ...g,
        subjectDoc: await ctx.db.get(g.subjectId),
      })),
    );
  },
});

/** Get longitudinal subject performance across all enrollments for a student. */
export const getLongitudinalSubjectPerformance = query({
  args: {
    studentId: v.id("students"),
    subjectId: v.id("subjects"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const grades = await ctx.db
      .query("computedGrades")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .filter((q) => q.eq(q.field("subjectId"), args.subjectId))
      .collect();

    // Batch-load enrollments, then batch-load years/levels (avoid N+1)
    const uniqueEnrollmentIds = [...new Set(grades.map((g) => g.enrollmentId))];
    const enrollments = await Promise.all(
      uniqueEnrollmentIds.map((id) => ctx.db.get(id)),
    );
    const enrollmentMap = new Map(
      enrollments.map((e, i) => [uniqueEnrollmentIds[i], e] as const),
    );

    const validEnrollments = [...enrollmentMap.values()].filter(
      (e): e is NonNullable<typeof e> => e != null,
    );
    const yearIds = [...new Set(validEnrollments.map((e) => e.academicYear))];
    const levelIds = [
      ...new Set(validEnrollments.map((e) => e.standardLevelId)),
    ];

    const [years, levels] = await Promise.all([
      Promise.all(yearIds.map((id) => ctx.db.get(id))),
      Promise.all(levelIds.map((id) => ctx.db.get(id))),
    ]);
    const yearMap = new Map(years.map((y, i) => [yearIds[i], y] as const));
    const levelMap = new Map(levels.map((l, i) => [levelIds[i], l] as const));

    return grades.map((g) => {
      const enrollment = enrollmentMap.get(g.enrollmentId);
      return {
        ...g,
        yearName: enrollment?.academicYear
          ? yearMap.get(enrollment.academicYear)?.name
          : undefined,
        levelName: enrollment?.standardLevelId
          ? levelMap.get(enrollment.standardLevelId)?.name
          : undefined,
      };
    });
  },
});
