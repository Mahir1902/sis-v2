import { ConvexError, v } from "convex/values";
import { deriveInviteState, INVITE_TTL_MS } from "../lib/inviteStatus";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";

/**
 * Admin-only invite lifecycle (spec #55 / ticket #57). Issues, lists, regenerates
 * and revokes email-bound, single-use invite tokens. The `users` row is born only
 * at acceptance, inside the auth gate (`convex/auth.ts`) — this file never creates
 * accounts. Guard rejections are `ConvexError`s carrying a stable `code` (plain
 * Error messages are redacted in production, so the UI branches on the code).
 */

/** 64-char hex, 256 bits of Web Crypto entropy — unguessable, URL-safe. */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Issue a pending invite for a new staff account. Role is restricted to
 * admin/teacher here (students have no login path in this effort) — the wider
 * schema union stays role-agnostic for a future student-invite UI.
 *
 * Guards (both reject before any write):
 *  - ACCOUNT_EXISTS — a `users` row already exists for this email (active OR
 *    deactivated); the UI points the admin at reactivate instead.
 *  - PENDING_INVITE_EXISTS — a still-`pending` invite exists (including a
 *    derived-expired one); the UI points the admin at Pending Invites (regenerate).
 */
export const createInvite = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("teacher")),
  },
  handler: async (ctx, args) => {
    const me = await requireRole(ctx, ["admin"]);

    const name = args.name.trim();
    const email = args.email.trim();
    if (name.length < 2) throw new ConvexError({ code: "INVALID_NAME" });
    if (!email.includes("@")) throw new ConvexError({ code: "INVALID_EMAIL" });

    // Guard 1 — any existing account (active or deactivated) blocks a new invite.
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existingUser !== null) {
      throw new ConvexError({
        code: "ACCOUNT_EXISTS",
        userId: existingUser._id,
      });
    }

    // Guard 2 — one live link per person. `status === "pending"` covers a
    // derived-expired invite too (expired is never stored), so the admin is sent
    // to Pending Invites to regenerate rather than piling up duplicate rows.
    const pending = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    if (pending !== null) {
      throw new ConvexError({ code: "PENDING_INVITE_EXISTS" });
    }

    const inviteId = await ctx.db.insert("invites", {
      token: generateToken(),
      email,
      role: args.role,
      name,
      status: "pending",
      expiresAt: Date.now() + INVITE_TTL_MS,
      invitedBy: me._id,
    });

    await logAudit(ctx, {
      user: me,
      action: "create",
      entityType: "invite",
      entityId: inviteId,
      description: `Issued ${args.role} invite for ${email}`,
    });

    // Full doc so the client can build `${origin}/invite/${token}`.
    return await ctx.db.get(inviteId);
  },
});

/**
 * Outstanding invites for the management tab — everything except `accepted`
 * (an accepted invite is now a real user in the Users tab). Each row carries a
 * `displayStatus` derived from the ONE shared function, so the query and the
 * acceptance page can never disagree about what "expired" means. Admin only.
 */
export const listInvites = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);
    const now = Date.now();

    // Invites are bounded by staff headcount; take() keeps it honestly bounded.
    // ponytail: take(200), add pagination if a school ever outgrows 200 live invites.
    const rows = (await ctx.db.query("invites").order("desc").take(200)).filter(
      (i) => i.status !== "accepted",
    );

    // Resolve inviter names once per unique inviter (no N+1).
    const inviterIds = [...new Set(rows.map((r) => r.invitedBy))];
    const inviters = await Promise.all(inviterIds.map((id) => ctx.db.get(id)));
    const nameById = new Map(
      inviters.map((u, i) => [inviterIds[i], u?.name ?? "Unknown"]),
    );

    return rows.map((r) => ({
      _id: r._id,
      token: r.token,
      email: r.email,
      name: r.name,
      role: r.role,
      status: r.status,
      expiresAt: r.expiresAt,
      invitedByName: nameById.get(r.invitedBy) ?? "Unknown",
      displayStatus: deriveInviteState(r.status, r.expiresAt, now),
    }));
  },
});

/**
 * Rotate the token + reset the 7-day expiry in place, reviving a pending or
 * derived-expired invite. Overwriting the token kills the old link instantly.
 * Terminal (accepted / revoked) invites cannot be regenerated. Admin only.
 */
export const regenerateInvite = mutation({
  args: { id: v.id("invites") },
  handler: async (ctx, args) => {
    const me = await requireRole(ctx, ["admin"]);
    const invite = await ctx.db.get(args.id);
    if (invite === null) throw new ConvexError({ code: "INVITE_NOT_FOUND" });
    if (invite.status !== "pending") {
      throw new ConvexError({ code: "INVITE_NOT_REGENERATABLE" });
    }

    await ctx.db.patch(args.id, {
      token: generateToken(),
      expiresAt: Date.now() + INVITE_TTL_MS,
    });

    await logAudit(ctx, {
      user: me,
      action: "update",
      entityType: "invite",
      entityId: args.id,
      description: `Regenerated invite for ${invite.email}`,
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Soft-terminal cancel: `pending → revoked`. A revoked invite stays on record
 * (greyed, no actions) so the cancellation is auditable. Admin only.
 */
export const revokeInvite = mutation({
  args: { id: v.id("invites") },
  handler: async (ctx, args) => {
    const me = await requireRole(ctx, ["admin"]);
    const invite = await ctx.db.get(args.id);
    if (invite === null) throw new ConvexError({ code: "INVITE_NOT_FOUND" });
    if (invite.status !== "pending") {
      throw new ConvexError({ code: "INVITE_NOT_REVOCABLE" });
    }

    await ctx.db.patch(args.id, { status: "revoked" });

    await logAudit(ctx, {
      user: me,
      action: "status_change",
      entityType: "invite",
      entityId: args.id,
      description: `Revoked invite for ${invite.email}`,
    });
  },
});
