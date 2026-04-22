import { query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

/**
 * Lightweight dashboard summary stats.
 * Suitable for a small school (hundreds of records).
 * Revisit with proper aggregation if record counts grow significantly.
 */
export const getSummaryStats = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);

    const students = await ctx.db.query("students").take(10000);
    const activeStudents = students.filter((s) => s.status === "active");

    const fees = await ctx.db.query("studentFees").take(10000);
    const totalOutstanding = fees.reduce((sum, f) => sum + f.balance, 0);
    const overdueCount = fees.filter(
      (f) => f.status !== "paid" && f.dueDate < Date.now()
    ).length;

    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .take(1000);

    return {
      totalStudents: students.length,
      activeStudents: activeStudents.length,
      totalOutstanding,
      overdueCount,
      assessmentCount: assessments.length,
    };
  },
});
