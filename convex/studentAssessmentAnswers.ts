import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import {
  enterMarks,
  markAbsent,
  paperQuestions,
  questionTotal,
} from "./lib/caPaper";
import { requireCapability } from "./lib/permissions";

// Thin public mutations: check the role, then hand the write to the CA Paper
// module (`lib/caPaper.ts`), which owns the rules and the grade recompute.

/** Upsert a single student's answer for a question. */
export const upsertAnswer = mutation({
  args: {
    studentId: v.id("students"),
    enrollmentId: v.id("enrollments"),
    assessmentId: v.id("assessments"),
    questionId: v.id("assessmentQuestions"),
    marksObtained: v.float64(),
    isAbsent: v.optional(v.boolean()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, { assessmentId, ...entry }) => {
    await requireCapability(ctx, "enterGrades");
    const { ids } = await enterMarks(ctx, assessmentId, [entry]);
    return ids[0];
  },
});

/** Batch mark entry for an entire class on one assessment. */
export const bulkMarkEntry = mutation({
  args: {
    assessmentId: v.id("assessments"),
    entries: v.array(
      v.object({
        studentId: v.id("students"),
        enrollmentId: v.id("enrollments"),
        questionId: v.id("assessmentQuestions"),
        marksObtained: v.float64(),
        isAbsent: v.optional(v.boolean()),
        remarks: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireCapability(ctx, "enterGrades");
    const { studentCount } = await enterMarks(
      ctx,
      args.assessmentId,
      args.entries,
    );
    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "studentAssessmentAnswers",
      entityId: args.assessmentId,
      description: `Entered marks for ${studentCount} students`,
    });
    return { count: args.entries.length };
  },
});

/** Mark a student absent for an entire assessment (zeroes all questions). */
export const markStudentAbsent = mutation({
  args: {
    studentId: v.id("students"),
    enrollmentId: v.id("enrollments"),
    assessmentId: v.id("assessments"),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "enterGrades");
    await markAbsent(ctx, args);
  },
});

/** Get all answers for an assessment (all students). Used for mark entry grid. */
export const getAnswersByAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "enterGrades");
    return await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .take(5000);
  },
});

/** Get per-question detail for one student on one assessment (CA-1/2/3). */
export const getStudentAssessmentDetail = query({
  args: {
    studentId: v.id("students"),
    subjectId: v.id("subjects"),
    semester: v.union(v.literal(1), v.literal(2)),
    standardLevelId: v.id("standardLevels"),
    academicYearId: v.id("academicYears"),
    assessmentNumber: v.union(v.literal(1), v.literal(2), v.literal(3)),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "enterGrades");

    // Find the assessment matching subject/semester/level/year/number
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_subject_semester", (q) =>
        q.eq("subjectId", args.subjectId).eq("semester", args.semester),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("standardLevelId"), args.standardLevelId),
          q.eq(q.field("academicYearId"), args.academicYearId),
          q.eq(q.field("assessmentNumber"), args.assessmentNumber),
          q.eq(q.field("isActive"), true),
        ),
      )
      .first();

    if (!assessments) return null;

    // Fetch questions and answers in parallel
    const [questions, answers] = await Promise.all([
      paperQuestions(ctx, assessments._id),
      ctx.db
        .query("studentAssessmentAnswers")
        .withIndex("by_student_assessment", (q) =>
          q.eq("studentId", args.studentId).eq("assessmentId", assessments._id),
        )
        .collect(),
    ]);

    const answerMap = new Map(answers.map((a) => [a.questionId.toString(), a]));

    const enrichedQuestions = questions.map((q) => {
      const answer = answerMap.get(q._id.toString());
      return {
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        marksAllocated: q.marksAllocated,
        marksObtained: answer?.marksObtained ?? null,
        isAbsent: answer?.isAbsent ?? false,
        remarks: answer?.remarks,
      };
    });

    const totalObtained = enrichedQuestions.reduce(
      (s, q) => s + (q.marksObtained ?? 0),
      0,
    );
    const totalPossible = questionTotal(questions);
    const isAbsent = answers.length > 0 && answers.every((a) => a.isAbsent);

    return {
      assessment: {
        name: assessments.name,
        assessmentNumber: assessments.assessmentNumber,
        totalMarks: assessments.totalMarks,
      },
      questions: enrichedQuestions,
      totalObtained,
      totalPossible,
      isAbsent,
    };
  },
});

/** Get all student answers for an enrollment grouped by assessment. */
export const getAnswersByEnrollment = query({
  args: { enrollmentId: v.id("enrollments") },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "enterGrades");
    return await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_enrollment", (q) =>
        q.eq("enrollmentId", args.enrollmentId),
      )
      .collect();
  },
});
