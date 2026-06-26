import { Migrations } from "@convex-dev/migrations";
import { v } from "convex/values";
import { applyBillingContactBackfill } from "../lib/applyBillingContactBackfill";
import { components, internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import schema from "./schema";

// ─── Migrations component init ─────────────────────────────────────────────
//
// `@convex-dev/migrations` provides batched, resumable migrations with state
// tracking, dry runs, and resume-from-failure. Each `migrations.define(...)`
// call below registers a migration runnable via `npx convex run ...`. See
// `docs/adr/0001-invoice-delivery-launcher-architecture.md` for the
// motivation behind the issue-#33 migrations.

// Schema is passed so `customRange` can use indexed reads — required for the
// invoice status rename which scans only `status === "sent"` via `by_status`.
// `DataModel` is inferred from the schema generic; passing both `<DataModel>`
// explicitly and `schema` conflicts (the schema generic supersedes).
export const migrations = new Migrations(components.migrations, {
  schema,
});

/**
 * General-purpose runner. Use:
 *   npx convex run migrations:run '{"fn":"migrations:<name>"}'
 *   npx convex run migrations:run '{"fn":"migrations:<name>","dryRun":true}'
 */
export const run = migrations.runner();

// ─── Issue #33: widen → migrate → narrow ───────────────────────────────────

/**
 * Backfills `students.primaryBillingContact = "father"` for every student
 * that lacks the field. Idempotent — students already carrying the field are
 * left untouched.
 *
 * Default of `"father"` matches the issue #33 spec. The narrow phase that
 * follows this migration makes the field required.
 *
 * Run via:
 *   npx convex run migrations:runBackfillPrimaryBillingContact
 *   npx convex run migrations:runBackfillPrimaryBillingContact '{"dryRun":true}'
 */
export const backfillPrimaryBillingContact = migrations.define({
  table: "students",
  migrateOne: (_ctx, student) => applyBillingContactBackfill(student),
});

export const runBackfillPrimaryBillingContact = migrations.runner(
  internal.migrations.backfillPrimaryBillingContact,
);

// ─── Removed migrations (issue #33 invoice-status rename; issue #36
//     invoiceNumber strip + studentFees partial-status narrow) ─────────────
//
// All ran cleanly on dev (hushed-bass-123) and were removed because the
// narrowed schema makes their literal patches untypeable. To re-run against a
// prod deployment still on the old shape, recover the bodies from git
// (`git log -p convex/migrations.ts`) and follow the widen-migrate-narrow
// sequence in docs/adr/0001-invoice-delivery-launcher-architecture.md.

// ─── Legacy one-shot migrations (kept for history / re-runnability) ────────

/**
 * Backfill migration: populates `standardLevelId` on existing
 * `feeCollectionSessions` that were created before the field was added.
 *
 * For each session missing `standardLevelId`:
 *   1. Looks up the student's enrollment for that session's academic year
 *      using the `by_student_academic_year` index on `enrollments`.
 *   2. Falls back to `students.standardLevel` if no enrollment exists.
 *
 * Processes in batches (default 100). Run from the Convex dashboard:
 *   Functions → migrations:backfillSessionStandardLevels → Run
 *
 * Safe to re-run — sessions that already have `standardLevelId` are skipped.
 */
export const backfillSessionStandardLevels = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    const sessions = await ctx.db
      .query("feeCollectionSessions")
      .order("asc")
      .take(batchSize + 1);

    // Filter to only those missing standardLevelId
    const toFix = sessions.filter((s) => s.standardLevelId === undefined);

    let patched = 0;

    for (const session of toFix) {
      const enrollment = await ctx.db
        .query("enrollments")
        .withIndex("by_student_academic_year", (q) =>
          q
            .eq("studentId", session.studentId)
            .eq("academicYear", session.academicYear),
        )
        .first();

      if (enrollment) {
        await ctx.db.patch(session._id, {
          standardLevelId: enrollment.standardLevelId,
        });
        patched++;
        continue;
      }

      const student = await ctx.db.get(session.studentId);
      if (student) {
        await ctx.db.patch(session._id, {
          standardLevelId: student.standardLevel,
        });
        patched++;
      }
    }

    return { patched, totalInBatch: sessions.length };
  },
});

/**
 * One-shot migration: renames the seeded campuses to Campus 01/02/03 and
 * patches their addresses to the real Dhaka addresses provided by the school.
 *
 * Maps by current name so this handles both the original seed defaults
 * (Main/East/West) and any partially-renamed live rows (Campus 1/2/3).
 * Anything that does not match is left alone and reported back so the operator
 * can decide whether to patch by id.
 *
 * Run once via:
 *   npx convex run migrations:renameCampusesToNumberedDhaka
 *
 * Idempotent — re-running after a successful pass is a no-op.
 */
export const renameCampusesToNumberedDhaka = internalMutation({
  args: {},
  handler: async (ctx) => {
    const CAMPUS_01 = {
      name: "Campus 01",
      address: "Sector 11, Road 05/A, House 30/A, Uttara, Dhaka-1230",
    };
    const CAMPUS_02 = {
      name: "Campus 02",
      address: "House 32, Road 28, Sector 7, Dhaka-1230",
    };
    const CAMPUS_03 = {
      name: "Campus 03",
      address: "Sector 7, Road 32, House 1, Uttara",
    };

    const TARGETS: Record<string, { name: string; address: string }> = {
      "Main Campus": CAMPUS_01,
      "Campus 1": CAMPUS_01,
      "Campus 01": CAMPUS_01,
      "East Campus": CAMPUS_02,
      "Campus 2": CAMPUS_02,
      "Campus 02": CAMPUS_02,
      "West Campus": CAMPUS_03,
      "Campus 3": CAMPUS_03,
      "Campus 03": CAMPUS_03,
    };

    const campuses = await ctx.db.query("campuses").take(100);
    const patched: { id: string; from: string; to: string }[] = [];
    const skipped: { id: string; name: string; reason: string }[] = [];

    for (const campus of campuses) {
      const target = TARGETS[campus.name];
      if (!target) {
        skipped.push({
          id: campus._id,
          name: campus.name,
          reason: "no-mapping",
        });
        continue;
      }
      if (campus.name === target.name && campus.address === target.address) {
        skipped.push({
          id: campus._id,
          name: campus.name,
          reason: "already-correct",
        });
        continue;
      }
      await ctx.db.patch(campus._id, {
        name: target.name,
        address: target.address,
      });
      patched.push({ id: campus._id, from: campus.name, to: target.name });
    }

    return { patched, skipped, total: campuses.length };
  },
});
