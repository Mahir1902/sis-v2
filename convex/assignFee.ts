import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

/**
 * Returns active fee structures for a student's standard level that can still
 * be assigned mid-semester.
 *
 * - Monthly structures are always returned (month-level availability is
 *   determined client-side via getAvailableMonths).
 * - One-time and yearly structures are excluded when the student already has a
 *   studentFee record for them in the given academic year.
 */
export const getAssignableStructures = query({
  args: {
    studentId: v.id("students"),
    academicYearId: v.id("academicYears"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    const feeStructures = await ctx.db
      .query("feeStructure")
      .withIndex("by_standard", (q) =>
        q.eq("standardLevel", student.standardLevel),
      )
      .take(50);

    const active = feeStructures.filter((s) => s.isActive);

    const existingFees = await ctx.db
      .query("studentFees")
      .withIndex("by_student_year", (q) =>
        q
          .eq("studentId", args.studentId)
          .eq("academicYear", args.academicYearId),
      )
      .take(200);

    const assignedNonMonthlyIds = new Set<string>();
    for (const fee of existingFees) {
      const structure = active.find((s) => s._id === fee.feeStructureId);
      if (structure && structure.frequency !== "monthly") {
        assignedNonMonthlyIds.add(fee.feeStructureId);
      }
    }

    return active.filter((s) => {
      if (s.frequency === "monthly") return true;
      return !assignedNonMonthlyIds.has(s._id);
    });
  },
});
