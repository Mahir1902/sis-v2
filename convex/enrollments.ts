import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/permissions";

/**
 * Create a new enrollment record for a student.
 */
export const createEnrollment = mutation({
  args: {
    studentId: v.id("students"),
    academicYear: v.id("academicYears"),
    standardLevelId: v.id("standardLevels"),
    campus: v.string(),
    section: v.optional(v.string()),
    rollNumber: v.optional(v.string()),
    enrollmentType: v.string(),
    enrollmentDate: v.float64(),
    previousEnrollmentId: v.optional(v.id("enrollments")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db.insert("enrollments", {
      ...args,
      status: "active",
    });
  },
});

/**
 * Get all enrollment history for a student, sorted newest first.
 * Resolves academicYear and standardLevel for each enrollment.
 */
export const getEnrollmentHistory = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher", "student"]);

    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student_academic_year", (q) =>
        q.eq("studentId", args.studentId)
      )
      .take(100);

    const enriched = await Promise.all(
      enrollments.map(async (enrollment) => {
        const [academicYear, standardLevel] = await Promise.all([
          ctx.db.get(enrollment.academicYear),
          ctx.db.get(enrollment.standardLevelId),
        ]);
        return {
          ...enrollment,
          academicYearDoc: academicYear,
          standardLevelDoc: standardLevel,
        };
      })
    );

    // Sort newest first (by enrollmentDate descending)
    return enriched.sort((a, b) => b.enrollmentDate - a.enrollmentDate);
  },
});

/**
 * Get the current active enrollment for a student.
 * Current = no exitDate set.
 */
export const getCurrentEnrollment = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher", "student"]);

    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student_academic_year", (q) =>
        q.eq("studentId", args.studentId)
      )
      .take(100);

    const current = enrollments.find((e) => e.exitDate === undefined);
    if (!current) return null;

    const [academicYear, standardLevel] = await Promise.all([
      ctx.db.get(current.academicYear),
      ctx.db.get(current.standardLevelId),
    ]);

    return { ...current, academicYearDoc: academicYear, standardLevelDoc: standardLevel };
  },
});

/**
 * Get active enrollments for a standard level + academic year.
 * Used for class lists (e.g., mark entry grid).
 */
export const getEnrollmentsByLevelYear = query({
  args: {
    standardLevelId: v.id("standardLevels"),
    academicYearId: v.id("academicYears"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_standard_level", (q) =>
        q.eq("standardLevelId", args.standardLevelId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("academicYear"), args.academicYearId),
          q.eq(q.field("status"), "active")
        )
      )
      .take(200);

    return await Promise.all(
      enrollments.map(async (e) => {
        const student = await ctx.db.get(e.studentId);
        return {
          ...e,
          studentName: student?.studentFullName ?? "Unknown",
          studentNumber: student?.studentNumber ?? "",
        };
      })
    );
  },
});

/**
 * Mark an enrollment as exited (graduated, transferred, etc.)
 * Also updates the student's status to match.
 */
export const updateEnrollmentExit = mutation({
  args: {
    enrollmentId: v.id("enrollments"),
    exitDate: v.float64(),
    exitReason: v.string(),
    exitDestination: v.optional(v.string()),
    exitNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) throw new Error("Enrollment not found");

    await ctx.db.patch(args.enrollmentId, {
      exitDate: args.exitDate,
      exitReason: args.exitReason,
      exitDestination: args.exitDestination,
      exitNotes: args.exitNotes,
      status: "completed",
    });

    // Mirror exit reason to student status
    const statusMap: Record<string, string> = {
      graduated: "graduated",
      transferred: "transferred",
      expelled: "expelled",
      suspended: "suspended",
      withdrawn: "withdrawn",
      promotion: "active",
    };
    const newStatus = statusMap[args.exitReason];
    if (newStatus) {
      await ctx.db.patch(enrollment.studentId, { status: newStatus as "active" | "graduated" | "transferred" | "withdrawn" | "suspended" | "expelled" });
    }

    return args.enrollmentId;
  },
});
