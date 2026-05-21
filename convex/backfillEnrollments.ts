import { internalMutation } from "./_generated/server";

/**
 * One-off script: creates an enrollment record for every student
 * that doesn't already have one for their current academic year.
 * Uses the student's existing campus, standardLevel, and academicYear fields.
 *
 * Run from the Convex dashboard → Functions → backfillEnrollments:run
 * Delete this file after use.
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {

    const students = await ctx.db.query("students").take(2000);
    let created = 0;
    let skipped = 0;

    for (const student of students) {
      const existing = await ctx.db
        .query("enrollments")
        .withIndex("by_student_academic_year", (q) =>
          q
            .eq("studentId", student._id)
            .eq("academicYear", student.academicYear),
        )
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("enrollments", {
        studentId: student._id,
        academicYear: student.academicYear,
        standardLevelId: student.standardLevel,
        campus: student.campus,
        enrollmentType: "new_admission",
        enrollmentDate: student._creationTime,
        status: "active",
      });
      created++;
    }

    return { created, skipped, total: students.length };
  },
});
