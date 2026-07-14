/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { redeemInvite } from "./auth";
import schema from "./schema";

/**
 * Behavioural contracts for the invite-only account-creation gate (spec #56).
 *
 * Two seams, per the spec's testing decisions:
 *  - The state-inspecting cases drive `redeemInvite` directly against a real
 *    mutation `ctx.db` via `t.run` — the mutation seam the gate calls. This
 *    avoids the JWT/session env the full `signIn` *success* path needs while
 *    still exercising the real DB reads/writes (precondition, email binding,
 *    single-use flip, role stamp).
 *  - The reject cases ALSO go through the real public `signIn` action, proving
 *    the endpoint is genuinely gated (these throw at the gate, before the
 *    token-generation step that would need deployment env).
 *
 * The pure 5-state / <48h boundary logic lives in `lib/inviteStatus.test.ts`.
 */

const modules = import.meta.glob("./**/*.*s");

type TC = TestConvex<typeof schema>;

const TEACHER_EMAIL = "teacher@school.edu";

let t: TC;
let adminId: Id<"users">;

beforeEach(async () => {
  t = convexTest(schema, modules);
  adminId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      name: "Admin",
      email: "admin@school.edu",
      role: "admin",
      isActive: true,
    }),
  );
});

/** Insert an invite directly (the create-invite mutation is a later ticket). */
async function seedInvite(overrides: {
  token: string;
  email?: string;
  role?: "admin" | "teacher" | "student";
  name?: string;
  status?: "pending" | "accepted" | "revoked";
  expiresAt: number;
}): Promise<Id<"invites">> {
  return t.run(async (ctx) =>
    ctx.db.insert("invites", {
      token: overrides.token,
      email: overrides.email ?? TEACHER_EMAIL,
      role: overrides.role ?? "teacher",
      name: overrides.name ?? "New Teacher",
      status: overrides.status ?? "pending",
      expiresAt: overrides.expiresAt,
      invitedBy: adminId,
    }),
  );
}

function userByEmail(email: string) {
  return t.run(async (ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first(),
  );
}

function inviteByToken(token: string) {
  return t.run(async (ctx) =>
    ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique(),
  );
}

describe("redeemInvite — the account-creation gate", () => {
  it("creates a user whose email + role come from the invite (never the client)", async () => {
    const now = Date.now();
    await seedInvite({ token: "tok1", role: "teacher", expiresAt: now + 1000 });

    const userId = await t.run((ctx) =>
      // Client tries to look like an admin; the invite says teacher — invite wins.
      redeemInvite(ctx.db, { email: TEACHER_EMAIL, inviteToken: "tok1" }, now),
    );

    const user = await userByEmail(TEACHER_EMAIL);
    expect(user?._id).toBe(userId);
    expect(user?.role).toBe("teacher");
    expect(user?.name).toBe("New Teacher");
    expect(user?.isActive).toBe(true);
  });

  it("flips the invite to accepted (single-use) atomically with the insert", async () => {
    const now = Date.now();
    await seedInvite({ token: "tok2", expiresAt: now + 1000 });

    await t.run((ctx) =>
      redeemInvite(ctx.db, { email: TEACHER_EMAIL, inviteToken: "tok2" }, now),
    );

    const invite = await inviteByToken("tok2");
    expect(invite?.status).toBe("accepted");
    expect(invite?.acceptedAt).toBeTypeOf("number");
  });

  it("rejects a second redemption of the same token", async () => {
    const now = Date.now();
    await seedInvite({ token: "tok3", expiresAt: now + 1000 });

    await t.run((ctx) =>
      redeemInvite(ctx.db, { email: TEACHER_EMAIL, inviteToken: "tok3" }, now),
    );

    await expect(
      t.run((ctx) =>
        redeemInvite(
          ctx.db,
          { email: TEACHER_EMAIL, inviteToken: "tok3" },
          now,
        ),
      ),
    ).rejects.toThrow("Invalid invite");
  });

  it("rejects an email that does not match the invite's bound email", async () => {
    const now = Date.now();
    await seedInvite({
      token: "tok4",
      email: TEACHER_EMAIL,
      expiresAt: now + 1000,
    });

    await expect(
      t.run((ctx) =>
        redeemInvite(
          ctx.db,
          { email: "attacker@evil.com", inviteToken: "tok4" },
          now,
        ),
      ),
    ).rejects.toThrow("Invalid invite");

    // No account minted for either email; the invite is still redeemable.
    expect(await userByEmail("attacker@evil.com")).toBeNull();
    expect(await userByEmail(TEACHER_EMAIL)).toBeNull();
    expect((await inviteByToken("tok4"))?.status).toBe("pending");
  });

  it("rejects an expired token", async () => {
    const now = Date.now();
    await seedInvite({ token: "tok5", expiresAt: now - 1 });

    await expect(
      t.run((ctx) =>
        redeemInvite(
          ctx.db,
          { email: TEACHER_EMAIL, inviteToken: "tok5" },
          now,
        ),
      ),
    ).rejects.toThrow("Invalid invite");
    expect(await userByEmail(TEACHER_EMAIL)).toBeNull();
  });

  it("rejects a revoked token", async () => {
    const now = Date.now();
    await seedInvite({
      token: "tok6",
      status: "revoked",
      expiresAt: now + 1000,
    });

    await expect(
      t.run((ctx) =>
        redeemInvite(
          ctx.db,
          { email: TEACHER_EMAIL, inviteToken: "tok6" },
          now,
        ),
      ),
    ).rejects.toThrow("Invalid invite");
    expect(await userByEmail(TEACHER_EMAIL)).toBeNull();
  });

  it("rejects a missing / unknown token", async () => {
    const now = Date.now();
    await expect(
      t.run((ctx) => redeemInvite(ctx.db, { email: TEACHER_EMAIL }, now)),
    ).rejects.toThrow("requires a valid invite");
    await expect(
      t.run((ctx) =>
        redeemInvite(
          ctx.db,
          { email: TEACHER_EMAIL, inviteToken: "nope" },
          now,
        ),
      ),
    ).rejects.toThrow("Invalid invite");
  });
});

describe("public signIn endpoint is gated server-side", () => {
  it("rejects signUp with no invite token", async () => {
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: {
          flow: "signUp",
          email: TEACHER_EMAIL,
          password: "hunter2pw",
        },
      }),
    ).rejects.toThrow();
    expect(await userByEmail(TEACHER_EMAIL)).toBeNull();
  });

  it("rejects signUp with an invalid invite token", async () => {
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: {
          flow: "signUp",
          email: TEACHER_EMAIL,
          password: "hunter2pw",
          inviteToken: "bogus",
        },
      }),
    ).rejects.toThrow();
    expect(await userByEmail(TEACHER_EMAIL)).toBeNull();
  });
});
