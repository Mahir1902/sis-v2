import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

// ─── Audit Log Action Types ──────────────────────────────────────────────────

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status_change"
  | "collect_payment"
  | "apply_discount"
  | "upload"
  | "promote"
  | "role_change";

// ─── Internal Helper ─────────────────────────────────────────────────────────

/**
 * Inserts a single audit log row. This is a plain async function — NOT a Convex
 * mutation — intended to be called inside existing mutations after the main
 * operation completes. The calling mutation's transaction guarantees atomicity.
 *
 * @param ctx - The MutationCtx from the calling mutation.
 * @param params - Audit log fields. `metadata` is typed as Record<string, unknown>
 *   for call-site safety, even though the schema stores it as v.any().
 */
export async function logAudit(
  ctx: MutationCtx,
  params: {
    user: { _id: Id<"users">; email: string; name: string };
    action: AuditAction;
    entityType: string;
    entityId: string;
    description: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    userId: params.user._id,
    userEmail: params.user.email,
    userName: params.user.name,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    description: params.description,
    metadata: params.metadata,
    timestamp: Date.now(),
  });
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Returns recent audit log entries ordered by timestamp descending.
 * Admin-only. Uses the by_timestamp index with .order("desc").
 * Defaults to 100 entries if no limit is provided.
 */
export const getRecentLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    const limit = args.limit ?? 100;

    return await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

/**
 * Returns audit log entries for a specific entity.
 * Admin-only. Uses the by_entity composite index (entityType, entityId).
 * Results are bounded to 100 rows to prevent unbounded reads.
 */
export const getLogsByEntity = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"]);

    return await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .take(100);
  },
});
