import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
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
    const user = await requireRole(ctx, ["admin"]);

    if (args.startDate >= args.endDate) {
      throw new Error("Start date must be before end date");
    }

    const existing = await ctx.db.query("academicYears").take(100);
    if (existing.some((y) => y.name === args.name)) {
      throw new Error("An academic year with this name already exists");
    }

    const id = await ctx.db.insert("academicYears", args);

    await logAudit(ctx, {
      user,
      action: "create",
      entityType: "academicYears",
      entityId: id,
      description: `Created academic year: ${args.name}`,
    });

    return id;
  },
});

/**
 * Update an academic year's name, bounds, or semester-1 end date.
 * Validates startDate < endDate, startDate < semester1EndDate < endDate,
 * and name uniqueness among other years. Requires admin role.
 */
export const update = mutation({
  args: {
    academicYearId: v.id("academicYears"),
    name: v.optional(v.string()),
    startDate: v.optional(v.float64()),
    endDate: v.optional(v.float64()),
    semester1EndDate: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    const year = await ctx.db.get(args.academicYearId);
    if (!year) throw new Error("Academic year not found");

    const { academicYearId, ...patch } = args;
    const next = { ...year, ...patch };

    if (next.startDate >= next.endDate) {
      throw new Error("Start date must be before end date");
    }
    if (
      next.semester1EndDate !== undefined &&
      (next.semester1EndDate <= next.startDate ||
        next.semester1EndDate >= next.endDate)
    ) {
      throw new Error("Semester 1 end date must fall inside the academic year");
    }
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) throw new Error("Name is required");
      const existing = await ctx.db.query("academicYears").take(100);
      if (
        existing.some((y) => y._id !== academicYearId && y.name === trimmed)
      ) {
        throw new Error("An academic year with this name already exists");
      }
      patch.name = trimmed;
    }

    await ctx.db.patch(academicYearId, patch);

    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "academicYears",
      entityId: academicYearId,
      description: `Updated academic year: ${patch.name ?? year.name}`,
      metadata: patch,
    });

    return academicYearId;
  },
});
