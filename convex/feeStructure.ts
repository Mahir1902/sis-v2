import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/permissions";

/** List all fee structures. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.db.query("feeStructure").take(200);
  },
});

/** Get a single fee structure by ID. */
export const getById = query({
  args: { id: v.id("feeStructure") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    return await ctx.db.get(args.id);
  },
});

/**
 * Get fee structures for a standard level, returning amounts by type.
 * Used in the admission form to auto-fill fee fields.
 */
export const getFormFees = query({
  args: { standardLevel: v.id("standardLevels") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const structures = await ctx.db
      .query("feeStructure")
      .withIndex("by_standard", (q) => q.eq("standardLevel", args.standardLevel))
      .take(50);

    const result = { admission: 0, tuition: 0, registration: 0 };
    for (const s of structures) {
      if (s.feeType === "admission") result.admission = s.baseAmount;
      if (s.feeType === "tuition") result.tuition = s.baseAmount;
      if (s.feeType === "registration") result.registration = s.baseAmount;
    }
    return result;
  },
});

/**
 * Get full fee structure docs for a standard level.
 * Used in the admission form to get the _id for creating studentFee records.
 */
export const getFormFeeStructure = query({
  args: { standardLevel: v.id("standardLevels") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db
      .query("feeStructure")
      .withIndex("by_standard", (q) => q.eq("standardLevel", args.standardLevel))
      .take(50);
  },
});

/** Create a new fee structure entry. */
export const createFee = mutation({
  args: {
    name: v.string(),
    baseAmount: v.float64(),
    frequency: v.union(
      v.literal("one-time"),
      v.literal("monthly"),
      v.literal("yearly")
    ),
    feeType: v.union(
      v.literal("admission"),
      v.literal("tuition"),
      v.literal("registration"),
      v.literal("library"),
      v.literal("sports"),
      v.literal("computer")
    ),
    standardLevel: v.id("standardLevels"),
    dueDate: v.optional(v.float64()),
    lateFeeConfig: v.optional(
      v.object({
        enabled: v.boolean(),
        amount: v.optional(v.float64()),
        amountPerDay: v.optional(v.float64()),
        maxAmount: v.optional(v.float64()),
        maxDays: v.optional(v.float64()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db.insert("feeStructure", { ...args, isActive: true });
  },
});
