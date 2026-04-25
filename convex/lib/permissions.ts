import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Role = "admin" | "teacher" | "student";

/**
 * Verifies the caller is authenticated and has one of the allowed roles.
 * Throws "Unauthenticated" or "Unauthorized" on failure.
 * Returns the user record on success.
 *
 * The Convex Auth JWT sub claim is "userId|sessionId". We extract the userId
 * (the _id from our users table, as returned by createOrUpdateUser) and do a
 * direct document lookup — no email needed from the JWT.
 */
export async function requireRole(
  ctx: MutationCtx | QueryCtx,
  allowedRoles: Role[],
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  // subject = "userId|sessionId" — extract userId (our users table _id)
  const userId = identity.subject.split("|")[0] as Id<"users">;
  const user = await ctx.db.get(userId);

  if (!user) throw new Error("Unauthorized");
  if (!user.isActive) throw new Error("Unauthorized");
  if (!allowedRoles.includes(user.role as Role))
    throw new Error("Unauthorized");

  return user;
}
