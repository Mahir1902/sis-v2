import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

/** Create a single question for an assessment. */
export const createQuestion = mutation({
  args: {
    assessmentId: v.id("assessments"),
    questionNumber: v.float64(),
    marksAllocated: v.float64(),
    questionText: v.optional(v.string()),
    learningObjective: v.optional(v.string()),
    conceptTag: v.optional(v.string()),
    displayOrder: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    await validateQuestionTotal(ctx, args.assessmentId, args.marksAllocated);
    return await ctx.db.insert("assessmentQuestions", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

/** Create multiple questions at once. */
export const bulkCreateQuestions = mutation({
  args: {
    assessmentId: v.id("assessments"),
    questions: v.array(
      v.object({
        questionNumber: v.float64(),
        marksAllocated: v.float64(),
        questionText: v.optional(v.string()),
        learningObjective: v.optional(v.string()),
        conceptTag: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) throw new Error("Assessment not found");
    const totalNewMarks = args.questions.reduce(
      (s, q) => s + q.marksAllocated,
      0,
    );
    const existingQuestions = await ctx.db
      .query("assessmentQuestions")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .take(200);
    const existingTotal = existingQuestions.reduce(
      (s, q) => s + q.marksAllocated,
      0,
    );
    if (existingTotal + totalNewMarks > assessment.totalMarks) {
      throw new Error(
        `Adding ${totalNewMarks} marks would exceed assessment total of ${assessment.totalMarks} (currently allocated: ${existingTotal})`,
      );
    }
    const ids = [];
    for (let i = 0; i < args.questions.length; i++) {
      const q = args.questions[i];
      const id = await ctx.db.insert("assessmentQuestions", {
        assessmentId: args.assessmentId,
        questionNumber: q.questionNumber,
        marksAllocated: q.marksAllocated,
        questionText: q.questionText,
        learningObjective: q.learningObjective,
        conceptTag: q.conceptTag,
        displayOrder: existingQuestions.length + i + 1,
        isActive: true,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});

/** Get questions for an assessment, ordered by displayOrder. */
export const getByAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.db
      .query("assessmentQuestions")
      .withIndex("by_assessment_order", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .take(200);
  },
});

/** Update a question's marks allocation. */
export const updateQuestion = mutation({
  args: {
    questionId: v.id("assessmentQuestions"),
    marksAllocated: v.optional(v.float64()),
    questionText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");

    // Validate marks won't exceed assessment total
    if (args.marksAllocated !== undefined) {
      const assessment = await ctx.db.get(question.assessmentId);
      if (!assessment) throw new Error("Assessment not found");
      const siblings = await ctx.db
        .query("assessmentQuestions")
        .withIndex("by_assessment", (q) =>
          q.eq("assessmentId", question.assessmentId),
        )
        .take(200);
      const othersTotal = siblings
        .filter((q) => q._id !== args.questionId)
        .reduce((sum, q) => sum + q.marksAllocated, 0);
      if (othersTotal + args.marksAllocated > assessment.totalMarks) {
        throw new Error(
          `Updating to ${args.marksAllocated} marks would exceed assessment total of ${assessment.totalMarks} (other questions: ${othersTotal})`,
        );
      }
    }

    const { questionId, ...updates } = args;
    await ctx.db.patch(questionId, updates);
  },
});

/** Delete a question and cascade-delete its student answers. */
export const deleteQuestion = mutation({
  args: {
    questionId: v.id("assessmentQuestions"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");

    // Cascade-delete all student answers for this question
    const answers = await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .take(5000);
    for (const answer of answers) {
      await ctx.db.delete(answer._id);
    }

    await ctx.db.delete(args.questionId);
  },
});

/** Internal helper — validates marks don't overflow assessment totalMarks. */
async function validateQuestionTotal(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
  newMarks: number,
) {
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) throw new Error("Assessment not found");
  const existing = await ctx.db
    .query("assessmentQuestions")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .take(200);
  const currentTotal = existing.reduce((s, q) => s + q.marksAllocated, 0);
  if (currentTotal + newMarks > assessment.totalMarks) {
    throw new Error(
      `Adding ${newMarks} marks would exceed assessment total of ${assessment.totalMarks} (current: ${currentTotal})`,
    );
  }
}
