import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";

/**
 * Compute and upsert grades for one student/enrollment/subject/semester.
 * Formula: weightedAvg = (ca1% × w1) + (ca2% × w2) + (ca3% × w3)
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

    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) throw new Error("Enrollment not found");

    // Load assessments for this subject/semester/level/year
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

    // No assessments for this subject at this level — skip
    if (assessments.length === 0) {
      return null;
    }

    // Get weighting rule (fall back to equal thirds)
    const rule = await ctx.db
      .query("assessmentWeightingRules")
      .withIndex("by_standard_subject_semester", (q) =>
        q
          .eq("standardLevelId", enrollment.standardLevelId)
          .eq("subjectId", args.subjectId)
          .eq("semester", args.semester),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    const w1 = rule?.ca1Weight ?? 1 / 3;
    const w2 = rule?.ca2Weight ?? 1 / 3;
    const w3 = rule?.ca3Weight ?? 1 / 3;

    // Calculate per-CA totals
    let ca1Marks: number | undefined;
    let ca2Marks: number | undefined;
    let ca3Marks: number | undefined;
    let ca1Total: number | undefined;
    let ca2Total: number | undefined;
    let ca3Total: number | undefined;

    // Batch-fetch all answers in parallel (avoid N+1)
    const allAnswersByAssessment = await Promise.all(
      assessments.map(async (assessment) => {
        const answers = await ctx.db
          .query("studentAssessmentAnswers")
          .withIndex("by_student_assessment", (q) =>
            q
              .eq("studentId", args.studentId)
              .eq("assessmentId", assessment._id),
          )
          .collect();
        return {
          assessmentNumber: assessment.assessmentNumber,
          marksObtained: answers.reduce((s, a) => s + a.marksObtained, 0),
          totalMarks: assessment.totalMarks,
        };
      }),
    );

    for (const {
      assessmentNumber,
      marksObtained,
      totalMarks,
    } of allAnswersByAssessment) {
      if (assessmentNumber === 1) {
        ca1Marks = marksObtained;
        ca1Total = totalMarks;
      } else if (assessmentNumber === 2) {
        ca2Marks = marksObtained;
        ca2Total = totalMarks;
      } else if (assessmentNumber === 3) {
        ca3Marks = marksObtained;
        ca3Total = totalMarks;
      }
    }

    // Calculate percentages
    const ca1Pct =
      ca1Total && ca1Total > 0 ? ((ca1Marks ?? 0) / ca1Total) * 100 : 0;
    const ca2Pct =
      ca2Total && ca2Total > 0 ? ((ca2Marks ?? 0) / ca2Total) * 100 : 0;
    const ca3Pct =
      ca3Total && ca3Total > 0 ? ((ca3Marks ?? 0) / ca3Total) * 100 : 0;

    const weightedAverage = ca1Pct * w1 + ca2Pct * w2 + ca3Pct * w3;
    const letterGrade = getLetterGrade(weightedAverage);
    const totalObtained = (ca1Marks ?? 0) + (ca2Marks ?? 0) + (ca3Marks ?? 0);
    const totalPossible = (ca1Total ?? 0) + (ca2Total ?? 0) + (ca3Total ?? 0);

    // Upsert computed grade
    const existing = await ctx.db
      .query("computedGrades")
      .withIndex("by_enrollment_semester", (q) =>
        q.eq("enrollmentId", args.enrollmentId).eq("semester", args.semester),
      )
      .filter((q) => q.eq(q.field("subjectId"), args.subjectId))
      .first();

    const gradeData = {
      studentId: args.studentId,
      enrollmentId: args.enrollmentId,
      subjectId: args.subjectId,
      semester: args.semester,
      ca1Marks,
      ca1Percentage: ca1Total ? ca1Pct : undefined,
      ca1TotalMarks: ca1Total,
      ca2Marks,
      ca2Percentage: ca2Total ? ca2Pct : undefined,
      ca2TotalMarks: ca2Total,
      ca3Marks,
      ca3Percentage: ca3Total ? ca3Pct : undefined,
      ca3TotalMarks: ca3Total,
      weightedAverage,
      letterGrade,
      totalMarksObtained: totalObtained,
      totalPossibleMarks: totalPossible,
      computedAt: Date.now(),
    };

    let gradeId: Id<"computedGrades">;
    if (existing) {
      await ctx.db.patch(existing._id, gradeData);
      gradeId = existing._id;
    } else {
      gradeId = await ctx.db.insert("computedGrades", gradeData);
    }

    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "computedGrades",
      entityId: gradeId,
      description: "Computed grades for student",
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

/** Get enrollment-level performance summary (avg, top/bottom subjects). */
export const getEnrollmentPerformance = query({
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

    if (grades.length === 0) return null;

    const withSubjects = await Promise.all(
      grades.map(async (g) => ({
        ...g,
        subjectDoc: await ctx.db.get(g.subjectId),
      })),
    );

    const avg =
      grades.reduce((s, g) => s + g.weightedAverage, 0) / grades.length;
    const sorted = [...withSubjects].sort(
      (a, b) => b.weightedAverage - a.weightedAverage,
    );
    const top3 = sorted.slice(0, 3);
    const bottom3 = sorted.slice(-3).reverse();

    // Grade distribution
    const distribution: Record<string, number> = {};
    for (const g of grades) {
      distribution[g.letterGrade] = (distribution[g.letterGrade] ?? 0) + 1;
    }

    return {
      averagePercentage: avg,
      top3,
      bottom3,
      distribution,
      subjectCount: grades.length,
    };
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

// ── Helper ────────────────────────────────────────────────────────────────────

function getLetterGrade(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
}
