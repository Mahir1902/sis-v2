import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Backfill migration: populates `standardLevelId` on existing
 * `feeCollectionSessions` that were created before the field was added.
 *
 * For each session missing `standardLevelId`:
 *   1. Looks up the student's enrollment for that session's academic year
 *      using the `by_student_academic_year` index on `enrollments`.
 *   2. Falls back to `students.standardLevel` if no enrollment exists.
 *
 * Processes in batches (default 100). Run from the Convex dashboard:
 *   Functions → migrations:backfillSessionStandardLevels → Run
 *
 * Safe to re-run — sessions that already have `standardLevelId` are skipped.
 */
export const backfillSessionStandardLevels = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    const sessions = await ctx.db
      .query("feeCollectionSessions")
      .order("asc")
      .take(batchSize + 1);

    // Filter to only those missing standardLevelId
    const toFix = sessions.filter((s) => s.standardLevelId === undefined);

    let patched = 0;

    for (const session of toFix) {
      const enrollment = await ctx.db
        .query("enrollments")
        .withIndex("by_student_academic_year", (q) =>
          q
            .eq("studentId", session.studentId)
            .eq("academicYear", session.academicYear),
        )
        .first();

      if (enrollment) {
        await ctx.db.patch(session._id, {
          standardLevelId: enrollment.standardLevelId,
        });
        patched++;
        continue;
      }

      const student = await ctx.db.get(session.studentId);
      if (student) {
        await ctx.db.patch(session._id, {
          standardLevelId: student.standardLevel,
        });
        patched++;
      }
    }

    return { patched, totalInBatch: sessions.length };
  },
});
