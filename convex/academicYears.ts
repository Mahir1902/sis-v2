import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { getCurrentAcademicYear, yearsOverlap } from "./lib/academicYear";
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
 * The current academic year — the one year covering today in Dhaka, or none
 * (`status: "none"` in a gap, `"overlap"` when years share today). Rules in
 * `lib/academicYear.ts`. Callers with no current year leave the year
 * unselected; they never guess.
 *
 * ponytail: "today" is read on the server when the query runs; an open
 * subscription is not re-run at midnight, so a page left open across a
 * year boundary shows the old answer until reloaded or a year is edited.
 */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "teacher", "student"]);
    return await getCurrentAcademicYear(ctx);
  },
});

/** Names of the other years sharing at least one day with `range`. */
function overlapping(
  years: Doc<"academicYears">[],
  range: { startDate: number; endDate: number },
  except?: Id<"academicYears">,
) {
  return years
    .filter((y) => y._id !== except && yearsOverlap(y, range))
    .map((y) => y.name);
}

/**
 * Create a new academic year.
 * Validates that startDate < endDate, that name is unique, and that it shares
 * no day with another year (an overlap leaves no current year on those days).
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
    const clash = overlapping(existing, args);
    if (clash.length > 0) {
      throw new ConvexError(`These dates overlap ${clash.join(", ")}`);
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
    // A date change may not ADD an overlap. Overlaps the year already had
    // (the seeded June–July ones) are tolerated, so fixing them one year at a
    // time never gets stuck behind the next year's overlap.
    if (patch.startDate !== undefined || patch.endDate !== undefined) {
      const years = await ctx.db.query("academicYears").take(100);
      const before = new Set(overlapping(years, year, academicYearId));
      const added = overlapping(years, next, academicYearId).filter(
        (name) => !before.has(name),
      );
      if (added.length > 0) {
        throw new ConvexError(`These dates overlap ${added.join(", ")}`);
      }
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
