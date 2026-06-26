import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

/** List all weighting rules for a standard level. */
export const listByLevel = query({
  args: { standardLevelId: v.id("standardLevels") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const rules = await ctx.db
      .query("assessmentWeightingRules")
      .withIndex("by_standard_subject_semester", (q) =>
        q.eq("standardLevelId", args.standardLevelId),
      )
      .collect();
    return await Promise.all(
      rules.map(async (r) => ({
        ...r,
        subjectDoc: await ctx.db.get(r.subjectId),
      })),
    );
  },
});

/** Create or update a weighting rule. Validates weights sum to ~1.0. */
export const upsertWeightingRule = mutation({
  args: {
    subjectId: v.id("subjects"),
    standardLevelId: v.id("standardLevels"),
    semester: v.union(v.literal(1), v.literal(2)),
    ca1Weight: v.float64(),
    ca2Weight: v.float64(),
    ca3Weight: v.float64(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const total = args.ca1Weight + args.ca2Weight + args.ca3Weight;
    if (Math.abs(total - 1.0) > 0.001) {
      throw new Error(`Weights must sum to 1.0 (got ${total.toFixed(3)})`);
    }
    const existing = await ctx.db
      .query("assessmentWeightingRules")
      .withIndex("by_standard_subject_semester", (q) =>
        q
          .eq("standardLevelId", args.standardLevelId)
          .eq("subjectId", args.subjectId)
          .eq("semester", args.semester),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ca1Weight: args.ca1Weight,
        ca2Weight: args.ca2Weight,
        ca3Weight: args.ca3Weight,
        isActive: true,
      });
      return existing._id;
    }
    return await ctx.db.insert("assessmentWeightingRules", {
      ...args,
      isActive: true,
    });
  },
});
