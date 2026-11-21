import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireCapability } from "./lib/permissions";

/** List all discount rules. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireCapability(ctx, "manageFeeStructures");
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
    const user = await requireCapability(ctx, "manageFeeStructures");
    const id = await ctx.db.insert("discountRules", {
      ...args,
      isActive: true,
    });
    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "discountRules",
      entityId: id,
      description: `Created discount rule: ${args.name}`,
    });
    return id;
  },
});

/** Toggle a discount rule active/inactive. */
export const toggleActive = mutation({
  args: { discountRuleId: v.id("discountRules"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireCapability(ctx, "manageFeeStructures");
    const { discountRuleId, isActive } = args;
    const rule = await ctx.db.get(discountRuleId);
    await ctx.db.patch(discountRuleId, { isActive });
    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "discountRules",
      entityId: discountRuleId,
      description: `Toggled discount rule: ${rule?.name ?? "unknown"} to ${isActive ? "active" : "inactive"}`,
    });
  },
});
