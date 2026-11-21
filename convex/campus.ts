import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCapability } from "./lib/permissions";

/** List all campuses. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireCapability(ctx, "viewReferenceData");
    return await ctx.db.query("campuses").take(100);
  },
});

/** Create a new campus. */
export const create = mutation({
  args: { name: v.string(), address: v.string() },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "manageSchoolSetup");
    return await ctx.db.insert("campuses", args);
  },
});
