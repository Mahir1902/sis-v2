import { ConvexError, v } from "convex/values";
import { GRANTABLE_CAPABILITIES } from "../lib/accessPolicy";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { requireCapability, studentLinkFor } from "./lib/permissions";

const grantableCapability = v.union(
  ...GRANTABLE_CAPABILITIES.map((capability) => v.literal(capability)),
);

/** Get the currently authenticated user's profile. */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    // subject = "userId|sessionId" — userId is our users table _id
    const userId = identity.subject.split("|")[0] as Id<"users">;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      // The student record a student account is linked to (Access Policy).
      studentId: user.studentId,
      // Extra features an admin granted this teacher.
      grants: user.grants,
    };
  },
});

/** List all users — admin only. */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireCapability(ctx, "manageUsers");
    const users = await ctx.db.query("users").take(500);
    // One read per linked student, batched — only student accounts have one.
    const linked = await Promise.all(
      users.map((u) => (u.studentId ? ctx.db.get(u.studentId) : null)),
    );
    return users.map((u, i) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      studentId: u.studentId,
      // Null when the account is linked to no student, or to a deleted one.
      linkedStudent: linked[i]
        ? {
            studentFullName: linked[i].studentFullName,
            studentNumber: linked[i].studentNumber,
          }
        : null,
      grants: u.grants ?? [],
    }));
  },
});

/**
 * Update a user's role — admin only. Cannot change own role.
 *
 * Making an account a student links it to `studentId` (required, and the
 * student must exist — `ConvexError` code `STUDENT_REQUIRED` otherwise); any
 * other role clears the link. A teacher's granted features go with the
 * teacher role: they are dropped whenever the role changes.
 */
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("teacher"),
      v.literal("student"),
    ),
    studentId: v.optional(v.id("students")),
  },
  handler: async (ctx, args) => {
    const caller = await requireCapability(ctx, "manageUsers");
    if (caller._id === args.userId) {
      throw new Error("You cannot change your own role");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    const studentId = await studentLinkFor(ctx.db, args.role, args.studentId);
    if (args.role === "student" && studentId === undefined) {
      throw new ConvexError({ code: "STUDENT_REQUIRED" });
    }
    const oldRole = target.role;
    await ctx.db.patch(args.userId, {
      role: args.role,
      studentId,
      grants: args.role === oldRole ? target.grants : undefined,
    });

    await logAudit(ctx, {
      user: caller,
      action: "role_change",
      entityType: "users",
      entityId: args.userId,
      description: `Changed user ${target.email} role from ${oldRole} to ${args.role}`,
      metadata: {
        oldRole,
        newRole: args.role,
        // Which student record the account can read is part of the change.
        oldStudentId: target.studentId,
        newStudentId: studentId,
      },
    });
  },
});

/**
 * Set the extra features one teacher has on top of the teacher role — admin
 * only. `grants` replaces the teacher's whole list (empty removes them all)
 * and may only name grantable features. Only a teacher account can hold
 * grants (`ConvexError` code `NOT_A_TEACHER` otherwise).
 */
export const setTeacherGrants = mutation({
  args: {
    userId: v.id("users"),
    grants: v.array(grantableCapability),
  },
  handler: async (ctx, args) => {
    const caller = await requireCapability(ctx, "manageUsers");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target.role !== "teacher") {
      throw new ConvexError({ code: "NOT_A_TEACHER" });
    }
    const oldGrants = target.grants ?? [];
    const newGrants = [...new Set(args.grants)];
    await ctx.db.patch(args.userId, { grants: newGrants });

    await logAudit(ctx, {
      user: caller,
      action: "update",
      entityType: "users",
      entityId: args.userId,
      description: `Changed extra access for ${target.email}`,
      metadata: { oldGrants, newGrants },
    });
  },
});

/** Deactivate a user — admin only. Cannot deactivate self. */
export const deactivateUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await requireCapability(ctx, "manageUsers");
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
    const user = await requireCapability(ctx, "manageUsers");
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
