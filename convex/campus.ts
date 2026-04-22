import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/permissions";

/** List all campuses. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "teacher", "student"]);
    return await ctx.db.query("campuses").take(100);
  },
});

/** Create a new campus. */
export const create = mutation({
  args: { name: v.string(), address: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db.insert("campuses", args);
  },
});
