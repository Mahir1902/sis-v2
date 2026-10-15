import { v } from "convex/values";
import { dhakaDate, isDateLabel, shiftDate } from "../lib/attendanceDate";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

/**
 * School closures (attendance spec §4.2). One row per closed date carrying a
 * campus list; a closure VOIDS the date for those campuses in every
 * attendance figure. Marks are never deleted — removing the closure restores
 * the day intact. No audit rows: createdBy/createdAt identify the author.
 */

/**
 * Closures in the inclusive "YYYY-MM-DD" range. A whole year is a few dozen
 * documents; shared by the attendance aggregates.
 */
export async function loadClosures(
  ctx: QueryCtx,
  start: string,
  end: string,
): Promise<Doc<"closures">[]> {
  return await ctx.db
    .query("closures")
    .withIndex("by_date", (q) => q.gte("date", start).lte("date", end))
    .take(1000);
}

/** The set of closed dates for one campus within a loaded closure list. */
export function closedDatesFor(
  closures: Doc<"closures">[],
  campus: Id<"campuses">,
): Set<string> {
  return new Set(
    closures.filter((c) => c.campuses.includes(campus)).map((c) => c.date),
  );
}

/** All closures in an academic year, with the creator's name. */
export const list = query({
  args: { academicYear: v.id("academicYears") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "teacher"]);
    const year = await ctx.db.get(args.academicYear);
    if (!year) throw new Error("Academic year not found");

    const closures = await loadClosures(
      ctx,
      dhakaDate(year.startDate),
      dhakaDate(year.endDate),
    );
    const creators = await Promise.all(
      closures.map((c) => ctx.db.get(c.createdBy)),
    );
    return closures.map((c, i) => ({
      _id: c._id,
      date: c.date,
      campuses: c.campuses,
      reason: c.reason,
      createdAt: c.createdAt,
      createdByName: creators[i]?.name ?? "Unknown",
    }));
  },
});

/**
 * Close every date in an inclusive range for the given campuses.
 * Counts existing attendance marks on those dates; if any exist and
 * `confirmVoid` is not set, returns `needsConfirmation` without writing —
 * the guard rail against a mistyped date silently dropping a real school
 * day out of every figure. Admin only.
 */
export const create = mutation({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    campuses: v.array(v.id("campuses")),
    reason: v.string(),
    confirmVoid: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    if (!isDateLabel(args.startDate) || !isDateLabel(args.endDate)) {
      throw new Error("Dates must be real calendar days as YYYY-MM-DD");
    }
    if (args.startDate > args.endDate) {
      throw new Error("Start date must not be after end date");
    }
    if (shiftDate(args.startDate, 366) < args.endDate) {
      throw new Error("A closure range cannot exceed one year");
    }
    const reason = args.reason.trim();
    if (!reason) throw new Error("Reason is required");
    if (args.campuses.length === 0) {
      throw new Error("Select at least one campus");
    }
    const campuses = [...new Set(args.campuses)];

    if (!args.confirmVoid) {
      const marks = await ctx.db
        .query("attendance")
        .withIndex("by_date", (q) =>
          q.gte("date", args.startDate).lte("date", args.endDate),
        )
        .take(10000);
      const affected = marks.filter((m) => campuses.includes(m.campus));
      if (affected.length > 0) {
        const classes = new Set(
          affected.map(
            (m) => `${m.campus}|${m.standardLevelId}|${m.academicYear}`,
          ),
        );
        return {
          ok: false as const,
          needsConfirmation: true as const,
          markCount: affected.length,
          classCount: classes.size,
        };
      }
    }

    const now = Date.now();
    let created = 0;
    for (
      let date = args.startDate;
      date <= args.endDate;
      date = shiftDate(date, 1)
    ) {
      const existing = await ctx.db
        .query("closures")
        .withIndex("by_date", (q) => q.eq("date", date))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          campuses: [...new Set([...existing.campuses, ...campuses])],
        });
      } else {
        await ctx.db.insert("closures", {
          date,
          campuses,
          reason,
          createdBy: user._id,
          createdAt: now,
        });
      }
      created += 1;
    }
    return { ok: true as const, created };
  },
});

/** Remove a closure, restoring the day in every figure. Admin only. */
export const remove = mutation({
  args: { closureId: v.id("closures") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const closure = await ctx.db.get(args.closureId);
    if (!closure) throw new Error("Closure not found");
    await ctx.db.delete(args.closureId);
    return null;
  },
});
