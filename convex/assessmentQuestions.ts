import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import {
  addQuestions,
  deleteQuestion as deletePaperQuestion,
  paperQuestions,
  updateQuestion as updatePaperQuestion,
} from "./lib/caPaper";
import { requireCapability } from "./lib/permissions";

// Thin public mutations: check the role, then hand the write to the CA Paper
// module (`lib/caPaper.ts`), which owns the allocation rules, the cascade and
// the class-wide grade recompute.

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
  handler: async (ctx, { assessmentId, ...question }) => {
    const user = await requireCapability(ctx, "manageAssessments");
    const [id] = await addQuestions(ctx, assessmentId, [question]);

    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "assessmentQuestions",
      entityId: id,
      description: "Created question for assessment",
    });

    return id;
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
    const user = await requireCapability(ctx, "manageAssessments");
    const ids = await addQuestions(ctx, args.assessmentId, args.questions);

    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "assessmentQuestions",
      entityId: ids[0],
      description: `Bulk created ${ids.length} questions`,
    });

    return ids;
  },
});

/** Get questions for an assessment, ordered by displayOrder. */
export const getByAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "manageAssessments");
    return await paperQuestions(ctx, args.assessmentId);
  },
});

/** Update a question's marks allocation. */
export const updateQuestion = mutation({
  args: {
    questionId: v.id("assessmentQuestions"),
    marksAllocated: v.optional(v.float64()),
    questionText: v.optional(v.string()),
  },
  handler: async (ctx, { questionId, ...updates }) => {
    const user = await requireCapability(ctx, "manageAssessments");
    const question = await updatePaperQuestion(ctx, questionId, updates);

    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "assessmentQuestions",
      entityId: questionId,
      description: `Updated question #${question.questionNumber}`,
    });
  },
});

/** Delete a question and cascade-delete its student answers. */
export const deleteQuestion = mutation({
  args: {
    questionId: v.id("assessmentQuestions"),
  },
  handler: async (ctx, args) => {
    const user = await requireCapability(ctx, "manageAssessments");
    const question = await deletePaperQuestion(ctx, args.questionId);

    await logAudit(ctx, {
      user,
      action: "delete",
      entityType: "assessmentQuestions",
      entityId: args.questionId,
      description: `Deleted question #${question.questionNumber}`,
    });
  },
});
