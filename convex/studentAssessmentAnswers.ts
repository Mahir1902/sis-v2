import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";

/**
 * Rejects marks for a student who is not in the assessment's class: every
 * entry's enrollment must be that student's, in the assessment's level and
 * year. Open is not required — a late CA mark for a closed enrollment of
 * that year is legitimate.
 */
async function assertInAssessmentClass(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
  entries: { studentId: Id<"students">; enrollmentId: Id<"enrollments"> }[],
) {
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) throw new ConvexError("Assessment not found");
  const ids = [...new Set(entries.map((e) => e.enrollmentId))];
  const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
  const byId = new Map(ids.map((id, i) => [id, docs[i]]));
  const misplaced = entries.some((e) => {
    const en = byId.get(e.enrollmentId);
    return (
      !en ||
      en.studentId !== e.studentId ||
      en.standardLevelId !== assessment.standardLevelId ||
      en.academicYear !== assessment.academicYearId
    );
  });
  if (misplaced) {
    throw new ConvexError(
      "A student here is not in this assessment's class. Reload the page and try again.",
    );
  }
}

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
    await assertInAssessmentClass(ctx, args.assessmentId, [args]);
    const existing = await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_student_assessment", (q) =>
        q.eq("studentId", args.studentId).eq("assessmentId", args.assessmentId),
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "teacher"]);
    await assertInAssessmentClass(ctx, args.assessmentId, args.entries);
    const now = Date.now();

    // Pre-load all existing answers for this assessment (avoid N+1)
    const allExisting = await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .collect();
    const existingMap = new Map(
      allExisting.map((a) => [`${a.studentId}|${a.questionId}`, a]),
    );

    // Count distinct students for the audit description
    const distinctStudents = new Set(args.entries.map((e) => e.studentId));

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

    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "studentAssessmentAnswers",
      entityId: args.assessmentId,
      description: `Entered marks for ${distinctStudents.size} students`,
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
    await requireRole(ctx, ["admin", "teacher"]);
    await assertInAssessmentClass(ctx, args.assessmentId, [args]);
    const questions = await ctx.db
      .query("assessmentQuestions")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .collect();

    // Pre-load existing answers for this student+assessment (avoid N+1)
    const existingAnswers = await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_student_assessment", (qb) =>
        qb
          .eq("studentId", args.studentId)
          .eq("assessmentId", args.assessmentId),
      )
      .collect();
    const answerMap = new Map(
      existingAnswers.map((a) => [a.questionId.toString(), a]),
    );

    const now = Date.now();
    for (const q of questions) {
      const existing = answerMap.get(q._id.toString());

      if (existing) {
        await ctx.db.patch(existing._id, {
          marksObtained: 0,
          isAbsent: true,
          enteredAt: now,
        });
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

/** Get all answers for an assessment (all students). Used for mark entry grid. */
export const getAnswersByAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
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
    await requireRole(ctx, ["admin", "teacher"]);

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
      ctx.db
        .query("assessmentQuestions")
        .withIndex("by_assessment_order", (q) =>
          q.eq("assessmentId", assessments._id),
        )
        .take(200),
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
    const totalPossible = enrichedQuestions.reduce(
      (s, q) => s + q.marksAllocated,
      0,
    );
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
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_enrollment", (q) =>
        q.eq("enrollmentId", args.enrollmentId),
      )
      .collect();
  },
});
