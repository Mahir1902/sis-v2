import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";
import { LEVEL_CODE_ORDER } from "./standardLevels";

/**
 * Create a new enrollment record for a student.
 */
export const createEnrollment = mutation({
  args: {
    studentId: v.id("students"),
    academicYear: v.id("academicYears"),
    standardLevelId: v.id("standardLevels"),
    campus: v.id("campuses"),
    section: v.optional(v.string()),
    rollNumber: v.optional(v.string()),
    enrollmentType: v.string(),
    enrollmentDate: v.float64(),
    previousEnrollmentId: v.optional(v.id("enrollments")),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    const enrollmentId = await ctx.db.insert("enrollments", {
      ...args,
      status: "active",
    });

    // Look up level and year names for a meaningful audit description
    const [level, year] = await Promise.all([
      ctx.db.get(args.standardLevelId),
      ctx.db.get(args.academicYear),
    ]);

    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "enrollments",
      entityId: enrollmentId,
      description: `Enrolled student in ${level?.name ?? "Unknown level"} for ${year?.name ?? "Unknown year"}`,
    });

    return enrollmentId;
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
        q.eq("studentId", args.studentId),
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
      }),
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
        q.eq("studentId", args.studentId),
      )
      .take(100);

    const current = enrollments.find((e) => e.exitDate === undefined);
    if (!current) return null;

    const [academicYear, standardLevel] = await Promise.all([
      ctx.db.get(current.academicYear),
      ctx.db.get(current.standardLevelId),
    ]);

    return {
      ...current,
      academicYearDoc: academicYear,
      standardLevelDoc: standardLevel,
    };
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
        q.eq("standardLevelId", args.standardLevelId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("academicYear"), args.academicYearId),
          q.eq(q.field("status"), "active"),
        ),
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
      }),
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
    const user = await requireRole(ctx, ["admin"]);

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
      await ctx.db.patch(enrollment.studentId, {
        status: newStatus as
          | "active"
          | "graduated"
          | "transferred"
          | "withdrawn"
          | "suspended"
          | "expelled",
      });
    }

    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "enrollments",
      entityId: args.enrollmentId,
      description: `Updated enrollment exit for student`,
    });

    return args.enrollmentId;
  },
});

/**
 * Campus-aware class roster for attendance: active enrollments in one
 * (campus, standardLevel, academicYear), sorted by student name.
 * Reuses `by_campus_standard` and filters year + status in the builder —
 * one (campus, level) pair across all years is a few hundred rows at most
 * (attendance spec §7 A4). Deliberately NOT `getEnrollmentsByLevelYear`,
 * which is campus-blind (#120).
 */
export const getClassRoster = query({
  args: {
    campus: v.id("campuses"),
    standardLevelId: v.id("standardLevels"),
    academicYear: v.id("academicYears"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await loadClassRoster(ctx, args);
  },
});

/**
 * Shared roster loader for `getClassRoster`, `attendance.getRegister` and
 * `attendance.getClassReport`. Active enrollments only, unless
 * `includeInactive` — reports keep leavers and past-year classes.
 */
export async function loadClassRoster(
  ctx: QueryCtx,
  args: {
    campus: Id<"campuses">;
    standardLevelId: Id<"standardLevels">;
    academicYear: Id<"academicYears">;
  },
  opts: { includeInactive?: boolean } = {},
) {
  const all = await ctx.db
    .query("enrollments")
    .withIndex("by_campus_standard", (q) =>
      q.eq("campus", args.campus).eq("standardLevelId", args.standardLevelId),
    )
    .filter((q) =>
      opts.includeInactive
        ? q.eq(q.field("academicYear"), args.academicYear)
        : q.and(
            q.eq(q.field("academicYear"), args.academicYear),
            q.eq(q.field("status"), "active"),
          ),
    )
    .take(200);
  const enrollments = [...new Map(all.map((e) => [e.studentId, e])).values()];

  const rows = await Promise.all(
    enrollments.map(async (e) => {
      const student = await ctx.db.get(e.studentId);
      return {
        enrollmentId: e._id,
        studentId: e.studentId,
        studentName: student?.studentFullName ?? "Unknown",
        studentNumber: student?.studentNumber ?? "",
      };
    }),
  );
  return rows.sort((a, b) => a.studentName.localeCompare(b.studentName));
}

/**
 * The distinct (campus, standardLevel) classes with enrollments (any status)
 * in a year; `studentCount` is distinct active students. A class exists
 * because students are enrolled in it — there is no classes table. One range
 * on `by_academic_year` (~400 rows per year), reduced in JS (attendance spec
 * §7 A3).
 */
export const getClassesForYear = query({
  args: { academicYear: v.id("academicYears") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await loadClassesForYear(ctx, args.academicYear);
  },
});

/** Shared class-list loader for `getClassesForYear` and `attendance.getDay`. */
export async function loadClassesForYear(
  ctx: QueryCtx,
  academicYear: Id<"academicYears">,
) {
  const enrollments = await ctx.db
    .query("enrollments")
    .withIndex("by_academic_year", (q) => q.eq("academicYear", academicYear))
    .take(2000);

  const counts = new Map<
    string,
    {
      campus: Id<"campuses">;
      standardLevelId: Id<"standardLevels">;
      active: Set<Id<"students">>;
    }
  >();
  for (const e of enrollments) {
    const key = `${e.campus}|${e.standardLevelId}`;
    let entry = counts.get(key);
    if (!entry) {
      entry = {
        campus: e.campus,
        standardLevelId: e.standardLevelId,
        active: new Set(),
      };
      counts.set(key, entry);
    }
    if (e.status === "active") entry.active.add(e.studentId);
  }

  const classes = await Promise.all(
    [...counts.values()].map(async ({ active, ...c }) => {
      const [campus, level] = await Promise.all([
        ctx.db.get(c.campus),
        ctx.db.get(c.standardLevelId),
      ]);
      return {
        ...c,
        studentCount: active.size,
        campusName: campus?.name ?? "Unknown campus",
        levelName: level?.name ?? "Unknown level",
        levelOrder: LEVEL_CODE_ORDER.indexOf(level?.code ?? ""),
      };
    }),
  );
  return classes
    .sort(
      (a, b) =>
        a.levelOrder - b.levelOrder || a.campusName.localeCompare(b.campusName),
    )
    .map(({ levelOrder: _o, ...c }) => c);
}
