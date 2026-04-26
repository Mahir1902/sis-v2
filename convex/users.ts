import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireRole } from "./lib/permissions";

/** Get the currently authenticated user's profile. */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    // subject = "userId|sessionId" — userId is our users table _id
    const userId = identity.subject.split(
      "|",
    )[0] as import("./_generated/dataModel").Id<"users">;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  },
});

/** List all users — admin only. */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);
    const users = await ctx.db.query("users").take(500);
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
    }));
  },
});

/** Update a user's role — admin only. Cannot change own role. */
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("teacher"),
      v.literal("student"),
    ),
  },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, ["admin"]);
    if (caller._id === args.userId) {
      throw new Error("You cannot change your own role");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    const oldRole = target.role;
    await ctx.db.patch(args.userId, { role: args.role });

    await logAudit(ctx, {
      user: caller,
      action: "role_change",
      entityType: "users",
      entityId: args.userId,
      description: `Changed user ${target.email} role from ${oldRole} to ${args.role}`,
      metadata: { oldRole, newRole: args.role },
    });
  },
});

/** Deactivate a user — admin only. Cannot deactivate self. */
export const deactivateUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, ["admin"]);
    if (caller._id === args.userId) {
      throw new Error("You cannot deactivate your own account");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    await ctx.db.patch(args.userId, { isActive: false });

    await logAudit(ctx, {
      user: caller,
      action: "status_change",
      entityType: "users",
      entityId: args.userId,
      description: `Deactivated user ${target.email}`,
    });
  },
});

/** Reactivate a user — admin only. */
export const reactivateUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    await ctx.db.patch(args.userId, { isActive: true });

    await logAudit(ctx, {
      user,
      action: "status_change",
      entityType: "users",
      entityId: args.userId,
      description: `Reactivated user ${target.email}`,
    });
  },
});
