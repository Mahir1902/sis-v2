import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";

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
