import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/permissions";

/** Upload a report card PDF for an enrollment+semester. */
export const uploadReportCard = mutation({
  args: {
    studentId: v.id("students"),
    enrollmentId: v.id("enrollments"),
    semester: v.union(v.literal(1), v.literal(2)),
    storageId: v.id("_storage"),
    fileName: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    // Enforce uniqueness: one report card per enrollment+semester
    const existing = await ctx.db
      .query("reportCards")
      .withIndex("by_enrollment_semester", (q) =>
        q.eq("enrollmentId", args.enrollmentId).eq("semester", args.semester)
      )
      .first();
    if (existing) {
      throw new Error("A report card for this semester already exists. Delete it first.");
    }
    return await ctx.db.insert("reportCards", {
      studentId: args.studentId,
      enrollmentId: args.enrollmentId,
      semester: args.semester,
      fileUrl: args.storageId,
      fileName: args.fileName,
      uploadedAt: Date.now(),
      notes: args.notes,
    });
  },
});

/** Get all report cards for a student. */
export const getByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const cards = await ctx.db
      .query("reportCards")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    return await Promise.all(
      cards.map(async (c) => {
        const enrollment = await ctx.db.get(c.enrollmentId);
        const year = enrollment?.academicYear
          ? await ctx.db.get(enrollment.academicYear)
          : null;
        const level = enrollment?.standardLevelId
          ? await ctx.db.get(enrollment.standardLevelId)
          : null;
        const fileUrl = await ctx.storage.getUrl(c.fileUrl);
        return { ...c, resolvedUrl: fileUrl, yearName: year?.name, levelName: level?.name };
      })
    );
  },
});

/** Get report cards for a specific enrollment. */
export const getByEnrollment = query({
  args: { enrollmentId: v.id("enrollments") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.db
      .query("reportCards")
      .withIndex("by_enrollment_semester", (q) => q.eq("enrollmentId", args.enrollmentId))
      .take(20);
  },
});

/** Generate upload URL for report card PDF. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Delete a report card and its storage file. */
export const deleteReportCard = mutation({
  args: { reportCardId: v.id("reportCards") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const card = await ctx.db.get(args.reportCardId);
    if (!card) throw new Error("Report card not found");
    await ctx.db.delete(args.reportCardId);
  },
});
