import { Migrations } from "@convex-dev/migrations";
import { v } from "convex/values";
import { applyBillingContactBackfill } from "../lib/applyBillingContactBackfill";
import { resolvePartialStatus } from "../lib/migratePartialStatus";
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

// ─── Removed: renameInvoiceStatusSentToIssued ──────────────────────────────
//
// The second issue-#33 migration rewrote every `invoices.status === "sent"`
// row to `"issued"` via the `by_status` index. It ran cleanly against the dev
// dataset (processed 0 rows — no `"sent"` invoices existed; the student
// backfill processed 27 rows). The schema was then narrowed to drop `"sent"`
// from the `invoices.status` union, which makes the rename migration's
// `"sent"` literal untypeable against the narrowed schema. The migration code
// was therefore removed from this file.
//
// ── Re-running on a production deployment that still has "sent" rows ──────
//
// The full migration body is reproduced below so the operator does not need
// to dig through git history. Follow the widen-migrate-narrow sequence:
//
//   1. Widen the invoices.status union in `convex/schema.ts` to accept both:
//
//        status: v.union(
//          v.literal("draft"),
//          v.literal("sent"),     // re-add temporarily
//          v.literal("issued"),
//          v.literal("paid"),
//          v.literal("overdue"),
//          v.literal("voided"),
//        ),
//
//   2. Deploy widened schema:  npx convex deploy --prod
//
//   3. Paste this migration back into the file:
//
//        export const renameInvoiceStatusSentToIssued = migrations.define({
//          table: "invoices",
//          customRange: (q) =>
//            q.withIndex("by_status", (q2) => q2.eq("status", "sent")),
//          migrateOne: () => ({ status: "issued" as const }),
//        });
//
//        export const runRenameInvoiceStatusSentToIssued = migrations.runner(
//          internal.migrations.renameInvoiceStatusSentToIssued,
//        );
//
//   4. Deploy + run:
//        npx convex deploy --prod
//        npx convex run migrations:runRenameInvoiceStatusSentToIssued --prod
//
//   5. Verify zero rows remain (dashboard or a one-shot query against
//      `by_status` with eq("status", "sent")).
//
//   6. Narrow the schema again (remove `v.literal("sent")`) and remove the
//      migration code from this file.
//
//   7. Final deploy:  npx convex deploy --prod
//
// Safety note: between steps 1 and 6 a `--prod` deploy from a branch carrying
// the narrowed schema (e.g. main) will be rejected by Convex's own schema
// validation against the still-`"sent"` rows. That is the intended fail-safe;
// do not bypass it.
//
// See `docs/adr/0001-invoice-delivery-launcher-architecture.md` for context.

// ─── Issue #36: widen → migrate → narrow ───────────────────────────────────
//
// Two cycles. Per HANDOFF_issue_36.md "Open landmines":
//   1. `feeCollectionSessions.invoiceNumber` is being dropped because the
//      Receipt-first model (ADR-0002) makes Sessions a pure transaction-log
//      primitive. The narrow step (removing the field from the schema) fails
//      if any row still carries the field, so we scrub every row first.
//   2. `studentFees.status` is being narrowed from `("unpaid","partial",
//      "paid")` to `("unpaid","paid")`. Each `partial` row gets flipped to
//      `paid` (if paidAmount fully covers the discounted total) or `unpaid`
//      (otherwise). See `lib/migratePartialStatus.ts` for the decision rule.

/**
 * Strips the legacy `invoiceNumber` field from every `feeCollectionSessions`
 * row. Runs as part of the Issue #36 widen-migrate-narrow cycle that drops
 * the field entirely. Idempotent — rows already missing the field are no-ops.
 *
 * Run via:
 *   npx convex run migrations:runStripFeeCollectionInvoiceNumber
 *   npx convex run migrations:runStripFeeCollectionInvoiceNumber '{"dryRun":true}'
 *
 * After this migration succeeds on every deployment that carried the
 * field, the narrow step (removing `invoiceNumber` + `by_invoice` from
 * `convex/schema.ts`) will deploy cleanly.
 *
 * NOTE: This migration is intended to be REMOVED after the narrow step,
 * because the narrowed schema no longer permits the `invoiceNumber` field
 * in patches. To re-run on a prod deployment that still has the field,
 * restore from git history via the procedure documented for the issue-#33
 * rename migration.
 */
export const stripFeeCollectionInvoiceNumber = migrations.define({
  table: "feeCollectionSessions",
  migrateOne: (_ctx, session) => {
    if (session.invoiceNumber === undefined) return; // idempotent
    return { invoiceNumber: undefined };
  },
});

export const runStripFeeCollectionInvoiceNumber = migrations.runner(
  internal.migrations.stripFeeCollectionInvoiceNumber,
);

/**
 * Flips every `studentFees.status === "partial"` row to either `"paid"` or
 * `"unpaid"` based on the pure-function decision rule in
 * `lib/migratePartialStatus.ts`. Idempotent — non-partial rows are no-ops.
 *
 * Decision rule (per HANDOFF_issue_36.md): a partial row becomes `paid` iff
 * `paidAmount >= originalAmount - sum(appliedDiscounts.amount)`, else `unpaid`.
 *
 * Run via:
 *   npx convex run migrations:runMigratePartialStudentFees
 *   npx convex run migrations:runMigratePartialStudentFees '{"dryRun":true}'
 *
 * NOTE: Same lifecycle as `stripFeeCollectionInvoiceNumber` — intended to be
 * removed after the narrow step that drops `"partial"` from the union.
 */
export const migratePartialStudentFees = migrations.define({
  table: "studentFees",
  migrateOne: (_ctx, fee) => {
    if (fee.status !== "partial") return; // idempotent
    return { status: resolvePartialStatus(fee) };
  },
});

export const runMigratePartialStudentFees = migrations.runner(
  internal.migrations.migratePartialStudentFees,
);

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
