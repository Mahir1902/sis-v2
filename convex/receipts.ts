import { v } from "convex/values";
import { query } from "./_generated/server";
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
