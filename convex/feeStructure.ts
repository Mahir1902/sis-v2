import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
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
      .withIndex("by_standard", (q) =>
        q.eq("standardLevel", args.standardLevel),
      )
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
      .withIndex("by_standard", (q) =>
        q.eq("standardLevel", args.standardLevel),
      )
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
      v.literal("yearly"),
    ),
    feeType: v.union(
      v.literal("admission"),
      v.literal("tuition"),
      v.literal("registration"),
      v.literal("library"),
      v.literal("sports"),
      v.literal("computer"),
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);
    const id = await ctx.db.insert("feeStructure", { ...args, isActive: true });
    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "feeStructures",
      entityId: id,
      description: `Created fee structure: ${args.name}`,
    });
    return id;
  },
});

/**
 * Update an existing fee structure's fields.
 * Only provided fields are patched. standardLevel is intentionally excluded
 * to prevent moving a fee between levels.
 * Requires admin role.
 */
export const updateFee = mutation({
  args: {
    feeId: v.id("feeStructure"),
    name: v.optional(v.string()),
    baseAmount: v.optional(v.float64()),
    frequency: v.optional(
      v.union(v.literal("one-time"), v.literal("monthly"), v.literal("yearly")),
    ),
    feeType: v.optional(
      v.union(
        v.literal("admission"),
        v.literal("tuition"),
        v.literal("registration"),
        v.literal("library"),
        v.literal("sports"),
        v.literal("computer"),
      ),
    ),
    dueDate: v.optional(v.float64()),
    lateFeeConfig: v.optional(
      v.object({
        enabled: v.boolean(),
        amount: v.optional(v.float64()),
        amountPerDay: v.optional(v.float64()),
        maxAmount: v.optional(v.float64()),
        maxDays: v.optional(v.float64()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);
    const fee = await ctx.db.get(args.feeId);
    if (!fee) throw new ConvexError("Fee structure not found");

    const { feeId, ...updates } = args;
    await ctx.db.patch(feeId, updates);

    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "feeStructures",
      entityId: feeId,
      description: `Updated fee structure: ${updates.name ?? fee.name}`,
    });
  },
});

/**
 * Toggle a fee structure's active status (soft delete / reactivate).
 * Requires admin role.
 */
export const toggleActive = mutation({
  args: { feeId: v.id("feeStructure"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);
    const { feeId, isActive } = args;
    const fee = await ctx.db.get(feeId);
    if (!fee) throw new ConvexError("Fee structure not found");
    await ctx.db.patch(feeId, { isActive });
    await logAudit(ctx, {
      user,
      action: "status_change",
      entityType: "feeStructures",
      entityId: feeId,
      description: `${isActive ? "Reactivated" : "Deactivated"} fee structure: ${fee?.name ?? "unknown"}`,
    });
  },
});

/**
 * Get all fee structures for a standard level with student counts.
 * Returns each fee structure enriched with the number of studentFees
 * referencing it, using the by_feeStructure index.
 * Requires admin role.
 */
export const getByLevel = query({
  args: { standardLevel: v.id("standardLevels") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const fees = await ctx.db
      .query("feeStructure")
      .withIndex("by_standard", (q) =>
        q.eq("standardLevel", args.standardLevel),
      )
      .take(50);

    const enriched = await Promise.all(
      fees.map(async (fee) => {
        const studentFees = await ctx.db
          .query("studentFees")
          .withIndex("by_feeStructure", (q) => q.eq("feeStructureId", fee._id))
          // .collect() is safe: filtered by index to a single feeStructureId
          .collect();
        return { ...fee, studentCount: studentFees.length };
      }),
    );

    return enriched;
  },
});
