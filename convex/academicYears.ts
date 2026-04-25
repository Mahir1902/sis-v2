import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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

/**
 * Create a new academic year.
 * Validates that startDate < endDate and that name is unique.
 * Requires admin role.
 */
export const create = mutation({
  args: {
    name: v.string(),
    startDate: v.float64(),
    endDate: v.float64(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    if (args.startDate >= args.endDate) {
      throw new Error("Start date must be before end date");
    }

    const existing = await ctx.db.query("academicYears").take(100);
    if (existing.some((y) => y.name === args.name)) {
      throw new Error("An academic year with this name already exists");
    }

    return await ctx.db.insert("academicYears", args);
  },
});
