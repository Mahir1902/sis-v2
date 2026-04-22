import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/permissions";

/** List all academic years, sorted by start date descending. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "teacher", "student"]);
    const years = await ctx.db.query("academicYears").take(100);
    return years.sort((a, b) => b.startDate - a.startDate);
  },
});

/** Create a new academic year. */
export const create = mutation({
  args: {
    name: v.string(),
    startDate: v.float64(),
    endDate: v.float64(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db.insert("academicYears", args);
  },
});
