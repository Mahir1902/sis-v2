import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";

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
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "teacher"]);
    // Prevent duplicate CA-X for same subject/semester/level/year
    const existing = await ctx.db
      .query("assessments")
      .withIndex("by_subject_semester", (q) =>
        q.eq("subjectId", args.subjectId).eq("semester", args.semester),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("standardLevelId"), args.standardLevelId),
          q.eq(q.field("academicYearId"), args.academicYearId),
          q.eq(q.field("assessmentNumber"), args.assessmentNumber),
        ),
      )
      .first();
    if (existing) {
      throw new Error(
        `CA-${args.assessmentNumber} already exists for this subject/semester/level/year`,
      );
    }
    const id = await ctx.db.insert("assessments", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });

    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "assessments",
      entityId: id,
      description: `Created assessment: ${args.name}`,
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
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "teacher"]);
    const ids = [];
    for (const num of [1, 2, 3] as const) {
      // Prevent duplicate CA-X for same subject/semester/level/year
      const existing = await ctx.db
        .query("assessments")
        .withIndex("by_subject_semester", (q) =>
          q.eq("subjectId", args.subjectId).eq("semester", args.semester),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("standardLevelId"), args.standardLevelId),
            q.eq(q.field("academicYearId"), args.academicYearId),
            q.eq(q.field("assessmentNumber"), num),
          ),
        )
        .first();
      if (existing) {
        throw new Error(
          `CA-${num} already exists for this subject/semester/level/year`,
        );
      }
      const id = await ctx.db.insert("assessments", {
        name: `CA-${num}`,
        assessmentNumber: num,
        semester: args.semester,
        subjectId: args.subjectId,
        standardLevelId: args.standardLevelId,
        academicYearId: args.academicYearId,
        totalMarks: args.totalMarks,
        isActive: true,
        createdAt: Date.now(),
      });
      ids.push(id);
    }

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
    await requireRole(ctx, ["admin", "teacher"]);
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
        const questions = await ctx.db
          .query("assessmentQuestions")
          .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
          .take(200);
        const totalQMarks = questions.reduce(
          (sum, q) => sum + q.marksAllocated,
          0,
        );
        return {
          ...a,
          subjectDoc: subject,
          questionCount: questions.length,
          totalQMarks,
        };
      }),
    );
  },
});

/** Get a single assessment by ID with its questions. */
export const getAssessmentById = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) return null;
    const questions = await ctx.db
      .query("assessmentQuestions")
      .withIndex("by_assessment_order", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .take(200);
    const subject = await ctx.db.get(assessment.subjectId);
    return { ...assessment, subjectDoc: subject, questions };
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
    await requireRole(ctx, ["admin", "teacher"]);
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_subject_semester", (q) =>
        q.eq("subjectId", args.subjectId).eq("semester", args.semester),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("standardLevelId"), args.standardLevelId),
          q.eq(q.field("academicYearId"), args.academicYearId),
          q.eq(q.field("isActive"), true),
        ),
      )
      .take(20);
    return assessments.sort((a, b) => a.assessmentNumber - b.assessmentNumber);
  },
});

/** Soft-delete an assessment. */
export const deactivateAssessment = mutation({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    await ctx.db.patch(args.assessmentId, { isActive: false });
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
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "teacher"]);
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) throw new Error("Assessment not found");

    // If lowering totalMarks, ensure it doesn't go below allocated question marks
    if (
      args.totalMarks !== undefined &&
      args.totalMarks < assessment.totalMarks
    ) {
      const questions = await ctx.db
        .query("assessmentQuestions")
        .withIndex("by_assessment", (q) =>
          q.eq("assessmentId", args.assessmentId),
        )
        .take(200);
      const allocatedMarks = questions.reduce(
        (sum, q) => sum + q.marksAllocated,
        0,
      );
      if (args.totalMarks < allocatedMarks) {
        throw new Error(
          `Cannot reduce total marks below ${allocatedMarks} (currently allocated across ${questions.length} questions)`,
        );
      }
    }

    const { assessmentId, ...updates } = args;
    // Remove undefined values so we only patch what was provided
    const patch: Partial<{
      name: string;
      totalMarks: number;
      passingMarks: number;
      assessmentDate: number;
    }> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.totalMarks !== undefined) patch.totalMarks = updates.totalMarks;
    if (updates.passingMarks !== undefined)
      patch.passingMarks = updates.passingMarks;
    if (updates.assessmentDate !== undefined)
      patch.assessmentDate = updates.assessmentDate;

    await ctx.db.patch(assessmentId, patch);

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
    const user = await requireRole(ctx, ["admin", "teacher"]);
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) throw new Error("Assessment not found");

    // Capture name before cascade-delete
    const assessmentName = assessment.name;

    // 1. Delete all student answers for this assessment
    const answers = await ctx.db
      .query("studentAssessmentAnswers")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .take(5000);
    for (const answer of answers) {
      await ctx.db.delete(answer._id);
    }

    // 2. Delete all questions for this assessment
    const questions = await ctx.db
      .query("assessmentQuestions")
      .withIndex("by_assessment", (q) =>
        q.eq("assessmentId", args.assessmentId),
      )
      .take(200);
    for (const question of questions) {
      await ctx.db.delete(question._id);
    }

    // 3. Delete the assessment itself
    await ctx.db.delete(args.assessmentId);

    await logAudit(ctx, {
      user,
      action: "delete",
      entityType: "assessments",
      entityId: args.assessmentId,
      description: `Deleted assessment: ${assessmentName}`,
    });

    return {
      deletedAnswers: answers.length,
      deletedQuestions: questions.length,
    };
  },
});
