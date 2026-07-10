import { v } from "convex/values";
import {
  applyReceiptsListFilter,
  type ReceiptListRow,
} from "../lib/receiptsListFilter";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";

/**
 * Maximum number of receipts fetched from the most-selective index before
 * client-side filter + sort. Bounded so the query never degrades with table
 * growth (per CLAUDE.md: no unbounded `.collect()`).
 *
 * The list page surfaces the most-recent receipts within a date window, so
 * a cap above one campus-year of payments is enough for v1. If volume grows
 * past this, the query should switch to cursor pagination.
 */
const LIST_RECEIPTS_FETCH_LIMIT = 500;

/**
 * Returns the Receipt row by id, exactly as stored.
 *
 * ADR-0002: the Receipt PDF is rendered entirely from the row's snapshot
 * fields (`studentNameSnapshot`, `payerName`, `lineItems`, etc.) — there
 * are NO live joins to `students`, `feeStructure`, or any other table.
 * Future edits to those source rows must not change what a parent sees on
 * a reprint, which is precisely why the snapshot fields exist.
 */
export const getReceipt = query({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt) {
      throw new Error("Receipt not found");
    }
    return receipt;
  },
});

/**
 * Returns the Receipt linked 1:1 with a given fee-collection session, or
 * `null` if none exists (legacy sessions predating the receipts table).
 *
 * Used by the Transaction Log session sheet to surface a "View Receipt"
 * link — see `app/(dashboard)/admin/transactions/_components/
 * SessionDetailSheet.tsx`.
 */
export const getBySession = query({
  args: { sessionId: v.id("feeCollectionSessions") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);
    return await ctx.db
      .query("receipts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();
  },
});

/**
 * Admin-only list query for `/receipts`. Returns receipt rows (without
 * `lineItems`) including `supersedes` and `supersededBy` so the list page
 * can badge correction chains without a per-row second query.
 *
 * Index strategy (most selective first):
 *   - `studentId` present  → `by_student`            (single-student view)
 *   - `status` present     → `by_status_and_payment_date` (status prefix)
 *   - neither              → `by_status_and_payment_date` for each of the
 *                            two known status values, merged
 *
 * The final date-range / studentId / status filter and sort happen in
 * `applyReceiptsListFilter` — a pure, unit-tested helper — to keep this
 * handler focused on Convex I/O.
 */
export const listReceipts = query({
  args: {
    dateRange: v.optional(v.object({ from: v.float64(), to: v.float64() })),
    studentId: v.optional(v.id("students")),
    status: v.optional(v.union(v.literal("issued"), v.literal("voided"))),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    let fetched: ReceiptListRow[];

    if (args.studentId) {
      const studentId = args.studentId;
      const rows = await ctx.db
        .query("receipts")
        .withIndex("by_student", (q) => q.eq("studentId", studentId))
        .take(LIST_RECEIPTS_FETCH_LIMIT);
      fetched = rows.map(toListRow);
    } else if (args.status) {
      const status = args.status;
      const rows = await ctx.db
        .query("receipts")
        .withIndex("by_status_and_payment_date", (q) => q.eq("status", status))
        .order("desc")
        .take(LIST_RECEIPTS_FETCH_LIMIT);
      fetched = rows.map(toListRow);
    } else {
      const perStatus = Math.ceil(LIST_RECEIPTS_FETCH_LIMIT / 2);
      const [issued, voided] = await Promise.all([
        ctx.db
          .query("receipts")
          .withIndex("by_status_and_payment_date", (q) =>
            q.eq("status", "issued"),
          )
          .order("desc")
          .take(perStatus),
        ctx.db
          .query("receipts")
          .withIndex("by_status_and_payment_date", (q) =>
            q.eq("status", "voided"),
          )
          .order("desc")
          .take(perStatus),
      ]);
      fetched = [...issued, ...voided].map(toListRow);
    }

    return applyReceiptsListFilter(fetched, {
      dateRange: args.dateRange,
      studentId: args.studentId,
      status: args.status,
    });
  },
});

function toListRow(receipt: Doc<"receipts">): ReceiptListRow {
  return {
    _id: receipt._id,
    receiptNumber: receipt.receiptNumber,
    studentId: receipt.studentId,
    studentNameSnapshot: receipt.studentNameSnapshot,
    studentNumberSnapshot: receipt.studentNumberSnapshot,
    payerName: receipt.payerName,
    status: receipt.status,
    paymentMethod: receipt.paymentMethod,
    paymentDate: receipt.paymentDate,
    totalAmount: receipt.totalAmount,
    supersedes: receipt.supersedes,
    supersededBy: receipt.supersededBy,
  };
}

/**
 * Cosmetic-edit correction (ADR-0003, issue #38). Admin can fix a typo in
 * `payerName`, `payerRole`, or `remarks` on an issued Receipt — without
 * producing a new Receipt number and without changing the lifecycle. The
 * PDF re-renders silently with the new values; the cosmetic-edit history
 * lives in the audit log only.
 *
 * Rejects voided receipts — those use `voidAndReissueReceipt` (separate
 * slice) to introduce a corrected row.
 */
export const editReceipt = mutation({
  args: {
    receiptId: v.id("receipts"),
    payerName: v.optional(v.string()),
    payerRole: v.optional(
      v.union(v.literal("father"), v.literal("mother"), v.literal("guardian")),
    ),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt) throw new Error("Receipt not found");
    if (receipt.status === "voided") {
      throw new Error("Cannot edit a voided receipt");
    }

    const patch: {
      payerName?: string;
      payerRole?: "father" | "mother" | "guardian";
      remarks?: string;
    } = {};
    const before: Record<string, string | undefined> = {};
    const after: Record<string, string | undefined> = {};

    if (args.payerName !== undefined && args.payerName !== receipt.payerName) {
      patch.payerName = args.payerName;
      before.payerName = receipt.payerName;
      after.payerName = args.payerName;
    }
    if (args.payerRole !== undefined && args.payerRole !== receipt.payerRole) {
      patch.payerRole = args.payerRole;
      before.payerRole = receipt.payerRole;
      after.payerRole = args.payerRole;
    }
    if (args.remarks !== undefined) {
      const currentRemarks = receipt.remarks ?? "";
      if (args.remarks !== currentRemarks) {
        patch.remarks = args.remarks;
        before.remarks = receipt.remarks;
        after.remarks = args.remarks;
      }
    }

    const changedFields = Object.keys(patch);
    if (changedFields.length === 0) {
      throw new Error("No changes to save");
    }

    await ctx.db.patch(args.receiptId, patch);

    await logAudit(ctx, {
      user,
      action: "update",
      entityType: "receipts",
      entityId: args.receiptId,
      description: `Cosmetic edit on receipt ${receipt.receiptNumber}: ${changedFields.join(", ")}`,
      metadata: { before, after, changedFields },
    });

    return null;
  },
});
