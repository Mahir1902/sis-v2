import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/permissions";

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
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const existing = await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_student_assessment", (q) =>
        q.eq("studentId", args.studentId).eq("assessmentId", args.assessmentId)
      )
      .filter((q) => q.eq(q.field("questionId"), args.questionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        marksObtained: args.marksObtained,
        isAbsent: args.isAbsent,
        remarks: args.remarks,
        enteredAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert("studentAssessmentAnswers", {
      ...args,
      enteredAt: Date.now(),
    });
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
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const now = Date.now();

    // Pre-load all existing answers for this assessment (avoid N+1)
    const allExisting = await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    const existingMap = new Map(
      allExisting.map((a) => [`${a.studentId}|${a.questionId}`, a])
    );

    for (const entry of args.entries) {
      const key = `${entry.studentId}|${entry.questionId}`;
      const existing = existingMap.get(key);

      if (existing) {
        await ctx.db.patch(existing._id, {
          marksObtained: entry.marksObtained,
          isAbsent: entry.isAbsent,
          remarks: entry.remarks,
          enteredAt: now,
        });
      } else {
        await ctx.db.insert("studentAssessmentAnswers", {
          studentId: entry.studentId,
          enrollmentId: entry.enrollmentId,
          assessmentId: args.assessmentId,
          questionId: entry.questionId,
          marksObtained: entry.marksObtained,
          isAbsent: entry.isAbsent,
          remarks: entry.remarks,
          enteredAt: now,
        });
      }
    }
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
    await requireRole(ctx, ["admin", "teacher"]);
    const questions = await ctx.db
      .query("assessmentQuestions")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();

    // Pre-load existing answers for this student+assessment (avoid N+1)
    const existingAnswers = await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_student_assessment", (qb) =>
        qb.eq("studentId", args.studentId).eq("assessmentId", args.assessmentId)
      )
      .collect();
    const answerMap = new Map(
      existingAnswers.map((a) => [a.questionId.toString(), a])
    );

    const now = Date.now();
    for (const q of questions) {
      const existing = answerMap.get(q._id.toString());

      if (existing) {
        await ctx.db.patch(existing._id, { marksObtained: 0, isAbsent: true, enteredAt: now });
      } else {
        await ctx.db.insert("studentAssessmentAnswers", {
          studentId: args.studentId,
          enrollmentId: args.enrollmentId,
          assessmentId: args.assessmentId,
          questionId: q._id,
          marksObtained: 0,
          isAbsent: true,
          enteredAt: now,
        });
      }
    }
  },
});

/** Get all answers for a student on one assessment, summed per-CA. */
export const getStudentAnswersByAssessment = query({
  args: {
    studentId: v.id("students"),
    assessmentId: v.id("assessments"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const answers = await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_student_assessment", (q) =>
        q.eq("studentId", args.studentId).eq("assessmentId", args.assessmentId)
      )
      .collect();
    const totalObtained = answers.reduce((s, a) => s + a.marksObtained, 0);
    const isAbsent = answers.some((a) => a.isAbsent);
    return { answers, totalObtained, isAbsent };
  },
});

/** Get all answers for an assessment (all students). Used for mark entry grid. */
export const getAnswersByAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .take(5000);
  },
});

/** Get all student answers for an enrollment grouped by assessment. */
export const getAnswersByEnrollment = query({
  args: { enrollmentId: v.id("enrollments") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_enrollment", (q) => q.eq("enrollmentId", args.enrollmentId))
      .collect();
  },
});
