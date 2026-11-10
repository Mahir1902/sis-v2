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

    // ponytail: counting means reading every student doc; ceiling is 10k
    // (silent past that). Move the counts to `@convex-dev/aggregate` if the
    // roll ever approaches it.
    const students = await ctx.db.query("students").take(10000);
    const activeStudents = students.filter((s) => s.status === "active");

    // Only unpaid fees carry a balance or can be overdue, so read just that
    // index range instead of the whole table.
    const now = Date.now();
    let totalOutstanding = 0;
    let overdueCount = 0;
    for await (const f of ctx.db
      .query("studentFees")
      .withIndex("by_status_and_due_date", (q) => q.eq("status", "unpaid"))) {
      totalOutstanding += f.balance;
      if (f.dueDate < now) overdueCount += 1;
    }

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
