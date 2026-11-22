import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { activeAssessmentsFor } from "./computedGrades";
import {
  createPapers,
  deactivatePaper,
  deletePaper,
  paperQuestions,
  questionTotal,
  updatePaper,
} from "./lib/caPaper";
import { requireCapability } from "./lib/permissions";

// Thin public mutations: check the role, then hand the write to the CA Paper
// module (`lib/caPaper.ts`), which owns the duplicate-CA rule, the cascade and
// the class-wide grade recompute.

/** Create a single assessment (CA-1, CA-2, or CA-3). */
export const createAssessment = mutation({
  args: {
    name: v.string(),
    assessmentNumber: v.union(v.literal(1), v.literal(2), v.literal(3)),
    semester: v.union(v.literal(1), v.literal(2)),
    subjectId: v.id("subjects"),
    standardLevelId: v.id("standardLevels"),
    academicYearId: v.id("academicYears"),
    totalMarks: v.float64(),
    passingMarks: v.optional(v.float64()),
    assessmentDate: v.optional(v.float64()),
  },
  handler: async (
    ctx,
    { semester, subjectId, standardLevelId, academicYearId, ...paper },
  ) => {
    const user = await requireCapability(ctx, "browseAssessments");
    const [id] = await createPapers(
      ctx,
      { semester, subjectId, standardLevelId, academicYear: academicYearId },
      [paper],
    );

    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "assessments",
      entityId: id,
      description: `Created assessment: ${paper.name}`,
    });

    return id;
  },
});

/** Bulk create CA-1, CA-2, CA-3 for a subject in one call. */
export const bulkCreateAssessments = mutation({
  args: {
    semester: v.union(v.literal(1), v.literal(2)),
    subjectId: v.id("subjects"),
    standardLevelId: v.id("standardLevels"),
    academicYearId: v.id("academicYears"),
    totalMarks: v.float64(),
  },
  handler: async (
    ctx,
    { semester, subjectId, standardLevelId, academicYearId, totalMarks },
  ) => {
    const user = await requireCapability(ctx, "browseAssessments");
    const ids = await createPapers(
      ctx,
      { semester, subjectId, standardLevelId, academicYear: academicYearId },
      ([1, 2, 3] as const).map((assessmentNumber) => ({
        name: `CA-${assessmentNumber}`,
        assessmentNumber,
        totalMarks,
      })),
    );

    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "assessments",
      entityId: ids[0],
      description: `Bulk created ${ids.length} assessments`,
    });

    return ids;
  },
});

/** List assessments filtered by standard level + academic year. */
export const getAssessmentsByLevelYear = query({
  args: {
    standardLevelId: v.id("standardLevels"),
    academicYearId: v.id("academicYears"),
    semester: v.optional(v.union(v.literal(1), v.literal(2))),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "browseAssessments");
    const q = ctx.db
      .query("assessments")
      .withIndex("by_standard_year", (q) =>
        q
          .eq("standardLevelId", args.standardLevelId)
          .eq("academicYearId", args.academicYearId),
      );
    const assessments = await q.take(200);
    const filtered = args.semester
      ? assessments.filter((a) => a.semester === args.semester)
      : assessments;

    return await Promise.all(
      filtered.map(async (a) => {
        const subject = await ctx.db.get(a.subjectId);
        const questions = await paperQuestions(ctx, a._id);
        return {
          ...a,
          subjectDoc: subject,
          questionCount: questions.length,
          totalQMarks: questionTotal(questions),
        };
      }),
    );
  },
});

/**
 * Get a single assessment by ID with its questions. `questionTotal` is the
 * real CA total (the sum of the question marks, ADR-0004) — what a student's
 * marks are out of; `totalMarks` is only the display target.
 */
export const getAssessmentById = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "manageAssessments");
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) return null;
    const questions = await paperQuestions(ctx, args.assessmentId);
    const subject = await ctx.db.get(assessment.subjectId);
    return {
      ...assessment,
      subjectDoc: subject,
      questions,
      questionTotal: questionTotal(questions),
    };
  },
});

/** Get assessments for a specific subject + semester (for grade entry). */
export const getAssessmentsBySubjectSemester = query({
  args: {
    subjectId: v.id("subjects"),
    semester: v.union(v.literal(1), v.literal(2)),
    standardLevelId: v.id("standardLevels"),
    academicYearId: v.id("academicYears"),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "manageAssessments");
    const assessments = await activeAssessmentsFor(ctx, {
      subjectId: args.subjectId,
      semester: args.semester,
      standardLevelId: args.standardLevelId,
      academicYear: args.academicYearId,
    });
    return assessments.sort((a, b) => a.assessmentNumber - b.assessmentNumber);
  },
});

/** Soft-delete an assessment. */
export const deactivateAssessment = mutation({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const user = await requireCapability(ctx, "manageAssessments");
    const { assessment, queued } = await deactivatePaper(
      ctx,
      args.assessmentId,
    );

    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "assessments",
      entityId: args.assessmentId,
      description: `Deactivated assessment: ${assessment.name} (${queued} grades queued for recompute)`,
    });
  },
});

/** Update editable assessment fields (name, totalMarks, passingMarks, assessmentDate). */
export const updateAssessment = mutation({
  args: {
    assessmentId: v.id("assessments"),
    name: v.optional(v.string()),
    totalMarks: v.optional(v.float64()),
    passingMarks: v.optional(v.float64()),
    assessmentDate: v.optional(v.float64()),
  },
  handler: async (ctx, { assessmentId, ...updates }) => {
    const user = await requireCapability(ctx, "manageAssessments");
    const assessment = await updatePaper(ctx, assessmentId, updates);

    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "assessments",
      entityId: assessmentId,
      description: `Updated assessment: ${updates.name ?? assessment.name}`,
    });
  },
});

/** Hard-delete an assessment and cascade-delete its questions and student answers. */
export const deleteAssessment = mutation({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const user = await requireCapability(ctx, "manageAssessments");
    const { assessment, deletedAnswers, deletedQuestions } = await deletePaper(
      ctx,
      args.assessmentId,
    );

    await logAudit(ctx, {
      user,
      action: "delete",
      entityType: "assessments",
      entityId: args.assessmentId,
      description: `Deleted assessment: ${assessment.name}`,
    });

    return { deletedAnswers, deletedQuestions };
  },
});
