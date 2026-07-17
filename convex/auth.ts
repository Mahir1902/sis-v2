import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { deriveInviteState } from "../lib/inviteStatus";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * The invite-only account-creation gate, as a plain helper so it can be driven
 * directly against a real mutation `ctx.db` in tests (the JWT/session plumbing
 * of the full `signIn` action needs deployment env we don't want in unit tests).
 * `createOrUpdateUser` below is the only production caller.
 *
 * Enforces (spec #56): an account is born ONLY by redeeming a valid, email-bound,
 * single-use invite token — role/email come from the invite, never the client,
 * and the invite flips to `accepted` in the SAME transaction as the user insert.
 */
export async function redeemInvite(
  db: MutationCtx["db"],
  profile: { email?: string; inviteToken?: string },
  now: number,
): Promise<Id<"users">> {
  const token = profile.inviteToken;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Account creation requires a valid invite");
  }

  const invite = await db
    .query("invites")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (
    invite === null ||
    deriveInviteState(invite.status, invite.expiresAt, now) !== "valid"
  ) {
    // Deliberately generic — the acceptance page never learns WHY a token is
    // dead, and a caller can't probe which emails exist.
    throw new Error("Invalid invite");
  }

  // Email binding: the credential id is the client-supplied email. It must
  // equal the invite's bound email, so a token issued for one person can never
  // mint an account for another.
  if (profile.email !== invite.email) {
    throw new Error("Invalid invite");
  }

  // Single-use: flip pending → accepted in the SAME transaction as the user
  // insert. A concurrent second redemption either re-reads `accepted` and fails
  // the `valid` precondition above, or loses the Convex OCC race on this patch
  // and retries into the same rejection.
  await db.patch(invite._id, { status: "accepted", acceptedAt: now });

  // Role / name / email come from the invite, never the client — so a caller
  // cannot self-escalate to admin. Reconcile against any pre-provisioned row
  // for this email (defensive; `createInvite` guards against inviting an
  // already-registered email).
  const existing = await db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", invite.email))
    .first();
  if (existing !== null) {
    await db.patch(existing._id, {
      name: invite.name,
      role: invite.role,
      isActive: true,
    });
    return existing._id;
  }
  return await db.insert("users", {
    name: invite.name,
    email: invite.email,
    role: invite.role,
    isActive: true,
  });
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Forward the admin-issued invite token from the client `signUp` params
      // into `createOrUpdateUser`, where the DB gate below runs. `profile` runs
      // in the ACTION context and its return value is serialized as a mutation
      // argument to `auth:store`, so it MUST stay synchronous — it cannot do a
      // DB lookup here. The token is validated later, inside the transaction.
      // (See docs/wayfinder/user-invites/tickets/assets/
      //  0049-convex-auth-token-gated-password.RESEARCH.md — the exact wiring.)
      profile(params): { email: string; [key: string]: string } {
        // Only carry the token when present, so the return stays a plain
        // `Value` map (no `undefined`) and normal sign-in is untouched.
        const out: { email: string; [key: string]: string } = {
          email: params.email as string,
        };
        if (typeof params.inviteToken === "string") {
          out.inviteToken = params.inviteToken;
        }
        return out;
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // Existing account (normal sign-in, seeded admin via retrieveAccount):
      // untouched. This branch keeps the seeded bootstrap admin and all normal
      // sign-ins working exactly as before.
      if (args.existingUserId !== null) return args.existingUserId;

      // Creation branch — invite-only, enforced server-side. `signUp` is a
      // public endpoint, so a UI check is not a control (spec #56, rules 1–3).
      // Cast to our MutationCtx so TS knows the `invites`/`users` indexes exist.
      const db = (ctx as unknown as MutationCtx).db;
      const profile = args.profile as { email?: string; inviteToken?: string };
      return await redeemInvite(db, profile, Date.now());
    },
  },
});
