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

// ── Ticket #57: create / list / regenerate / revoke ────────────────────────────

/** The admin-scoped client. `requireRole` reads userId from `subject`'s prefix. */
function asAdmin() {
  return t.withIdentity({ subject: `${adminId}|test-session` });
}

function auditEntriesForInvites() {
  return t.run(async (ctx) =>
    ctx.db
      .query("auditLogs")
      .filter((q) => q.eq(q.field("entityType"), "invite"))
      .collect(),
  );
}

describe("createInvite", () => {
  it("issues a pending, unexpired invite bound to the email", async () => {
    const invite = await asAdmin().mutation(api.invites.createInvite, {
      name: "New Teacher",
      email: TEACHER_EMAIL,
      role: "teacher",
    });

    expect(invite?.status).toBe("pending");
    expect(invite?.email).toBe(TEACHER_EMAIL);
    expect(invite?.role).toBe("teacher");
    expect(invite?.name).toBe("New Teacher");
    expect(invite?.token).toMatch(/^[0-9a-f]{64}$/);
    expect(invite?.expiresAt).toBeGreaterThan(Date.now());

    // Audit entry written (assert THAT one exists, not its wording).
    expect((await auditEntriesForInvites()).length).toBeGreaterThanOrEqual(1);
  });

  it("rejects an email with an existing ACTIVE account (reactivate code)", async () => {
    await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Existing",
        email: TEACHER_EMAIL,
        role: "teacher",
        isActive: true,
      }),
    );

    await expect(
      asAdmin().mutation(api.invites.createInvite, {
        name: "New Teacher",
        email: TEACHER_EMAIL,
        role: "teacher",
      }),
    ).rejects.toMatchObject({ data: { code: "ACCOUNT_EXISTS" } });
  });

  it("rejects an email with an existing DEACTIVATED account (reactivate code)", async () => {
    await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Deactivated",
        email: TEACHER_EMAIL,
        role: "teacher",
        isActive: false,
      }),
    );

    await expect(
      asAdmin().mutation(api.invites.createInvite, {
        name: "New Teacher",
        email: TEACHER_EMAIL,
        role: "teacher",
      }),
    ).rejects.toMatchObject({ data: { code: "ACCOUNT_EXISTS" } });
  });

  it("rejects an email that already has a pending invite (pending code)", async () => {
    await seedInvite({ token: "existing", expiresAt: Date.now() + 1000 });

    await expect(
      asAdmin().mutation(api.invites.createInvite, {
        name: "New Teacher",
        email: TEACHER_EMAIL,
        role: "teacher",
      }),
    ).rejects.toMatchObject({ data: { code: "PENDING_INVITE_EXISTS" } });
  });

  it("is admin-only — a teacher caller is rejected by requireRole", async () => {
    const teacherId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Teacher",
        email: "someteacher@school.edu",
        role: "teacher",
        isActive: true,
      }),
    );

    await expect(
      t
        .withIdentity({ subject: `${teacherId}|s` })
        .mutation(api.invites.createInvite, {
          name: "New Teacher",
          email: TEACHER_EMAIL,
          role: "teacher",
        }),
    ).rejects.toThrow("Unauthorized");
  });
});

describe("listInvites", () => {
  it("excludes accepted, includes pending/expired/revoked, derives displayStatus", async () => {
    const now = Date.now();
    await seedInvite({ token: "p", email: "p@s.edu", expiresAt: now + 100000 });
    await seedInvite({ token: "e", email: "e@s.edu", expiresAt: now - 1 });
    await seedInvite({
      token: "r",
      email: "r@s.edu",
      status: "revoked",
      expiresAt: now + 100000,
    });
    await seedInvite({
      token: "a",
      email: "a@s.edu",
      status: "accepted",
      expiresAt: now + 100000,
    });

    const rows = await asAdmin().query(api.invites.listInvites, {});
    const byEmail = new Map(rows.map((r) => [r.email, r]));

    expect(byEmail.has("a@s.edu")).toBe(false); // accepted hidden
    expect(byEmail.get("p@s.edu")?.displayStatus).toBe("valid");
    expect(byEmail.get("e@s.edu")?.displayStatus).toBe("expired");
    expect(byEmail.get("r@s.edu")?.displayStatus).toBe("revoked");
    expect(byEmail.get("p@s.edu")?.invitedByName).toBe("Admin");
  });
});

describe("regenerateInvite", () => {
  it("rotates the token + resets expiry on a pending invite; old token dies", async () => {
    const id = await seedInvite({
      token: "old1",
      expiresAt: Date.now() + 1000,
    });

    const updated = await asAdmin().mutation(api.invites.regenerateInvite, {
      id,
    });

    expect(updated?.token).not.toBe("old1");
    expect(updated?.token).toMatch(/^[0-9a-f]{64}$/);
    expect(await inviteByToken("old1")).toBeNull(); // old link no longer resolves
    expect(updated?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("revives an EXPIRED invite (rotates token, pushes expiry into the future)", async () => {
    const id = await seedInvite({ token: "old2", expiresAt: Date.now() - 1 });

    const updated = await asAdmin().mutation(api.invites.regenerateInvite, {
      id,
    });

    expect(updated?.token).not.toBe("old2");
    expect(updated?.expiresAt).toBeGreaterThan(Date.now());
    expect((await auditEntriesForInvites()).length).toBeGreaterThanOrEqual(1);
  });

  it("cannot regenerate a terminal (revoked) invite", async () => {
    const id = await seedInvite({
      token: "rev",
      status: "revoked",
      expiresAt: Date.now() + 1000,
    });

    await expect(
      asAdmin().mutation(api.invites.regenerateInvite, { id }),
    ).rejects.toMatchObject({ data: { code: "INVITE_NOT_REGENERATABLE" } });
  });
});

describe("revokeInvite", () => {
  it("moves pending → revoked (terminal) and audits", async () => {
    const id = await seedInvite({ token: "tok", expiresAt: Date.now() + 1000 });

    await asAdmin().mutation(api.invites.revokeInvite, { id });

    expect((await inviteByToken("tok"))?.status).toBe("revoked");
    expect((await auditEntriesForInvites()).length).toBeGreaterThanOrEqual(1);

    // Terminal — a second revoke is rejected.
    await expect(
      asAdmin().mutation(api.invites.revokeInvite, { id }),
    ).rejects.toMatchObject({ data: { code: "INVITE_NOT_REVOCABLE" } });
  });
});

describe("getInviteByToken (public acceptance-page resolver)", () => {
  it("returns identity ONLY for a valid token", async () => {
    await seedInvite({
      token: "good",
      email: "new@school.edu",
      role: "teacher",
      name: "New Teacher",
      expiresAt: Date.now() + 100000,
    });

    // No identity — this endpoint is public, so it must run unauthenticated.
    const res = await t.query(api.invites.getInviteByToken, { token: "good" });

    expect(res).toEqual({
      state: "valid",
      email: "new@school.edu",
      role: "teacher",
      name: "New Teacher",
    });
  });

  it("leaks nothing but the state for dead/unknown tokens", async () => {
    await seedInvite({ token: "exp", expiresAt: Date.now() - 1 });
    await seedInvite({
      token: "acc",
      status: "accepted",
      expiresAt: Date.now() + 100000,
    });
    await seedInvite({
      token: "rev",
      status: "revoked",
      expiresAt: Date.now() + 100000,
    });

    const q = (token: string) =>
      t.query(api.invites.getInviteByToken, { token });

    expect(await q("exp")).toEqual({ state: "expired" });
    expect(await q("acc")).toEqual({ state: "used" }); // accepted → "used" wording
    expect(await q("rev")).toEqual({ state: "revoked" });
    expect(await q("nope")).toEqual({ state: "invalid" }); // unknown token
  });
});
