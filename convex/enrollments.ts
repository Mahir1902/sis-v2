import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { requireRole } from "./lib/permissions";
import { getCurrentPlacement } from "./lib/placement";
import { LEVEL_CODE_ORDER } from "./standardLevels";

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
 * The student's Current Placement (open enrollment) with year + level
 * resolved, or null — never their last placement (CONTEXT.md).
 */
export const getCurrentEnrollment = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher", "student"]);

    const current = await getCurrentPlacement(ctx, args.studentId);
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
          q.eq(q.field("exitDate"), undefined),
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
 * Campus-aware class roster for attendance: active enrollments in one
 * (campus, standardLevel, academicYear), sorted by student name.
 * Reuses `by_campus_standard` and filters year + open (`exitDate` unset) in the builder —
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
            q.eq(q.field("exitDate"), undefined),
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
    // Imported rows may lack a campus; they cannot form a class.
    if (!e.campus) continue;
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
    if (e.exitDate === undefined) entry.active.add(e.studentId);
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
