import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCapability } from "./lib/permissions";

/** List all subjects (including inactive) — alias: list. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireCapability(ctx, "viewClasses");
    const subjects = await ctx.db.query("subjects").take(200);
    return subjects.sort(
      (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999),
    );
  },
});

/** Toggle a subject active/inactive. */
export const toggleActive = mutation({
  args: { subjectId: v.id("subjects"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "manageSchoolSetup");
    await ctx.db.patch(args.subjectId, { isActive: args.isActive });
  },
});

/** Create a new subject. */
export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    displayOrder: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "manageSchoolSetup");
    return await ctx.db.insert("subjects", { ...args, isActive: true });
  },
});
