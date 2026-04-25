import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

/** List all discount rules. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db.query("discountRules").take(100);
  },
});

/** Create a discount rule. */
export const create = mutation({
  args: {
    name: v.string(),
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    amount: v.float64(),
    maxDiscountAmount: v.optional(v.float64()),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db.insert("discountRules", { ...args, isActive: true });
  },
});

/** Toggle a discount rule active/inactive. */
export const toggleActive = mutation({
  args: { discountRuleId: v.id("discountRules"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const { discountRuleId, isActive } = args;
    await ctx.db.patch(discountRuleId, { isActive });
  },
});
