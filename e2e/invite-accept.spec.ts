import { expect, test } from "@playwright/test";

/**
 * End-to-end invite journey (ticket #61) — the all-surfaces-shipped integration
 * gate for spec #55. Runs against a LIVE dev deployment (needs `npm run dev` +
 * the seeded admin `admin@school.edu`); deeper state coverage lives cheaply in
 * the seam unit tests (`lib/inviteStatus.test.ts`, `convex/invites.test.ts`), so
 * this keeps to the two journeys that only a real backend + real token can prove:
 *
 *  1. Happy path: admin signs in → creates an invite → the reveal shows a
 *     copyable link → visiting `/invite/<token>` UNAUTHENTICATED renders the
 *     welcome + password form → setting a password lands the new user
 *     signed-in on `/students`.
 *  2. Dead token: a bogus token renders the non-leaky "not valid" screen — no
 *     form, no leak of why the token is dead.
 *
 * The invitee runs in a SEPARATE browser context so it's genuinely
 * unauthenticated (the proxy bounces authed users off the public invite route).
 * A unique invitee email per run keeps the createInvite guards (ACCOUNT_EXISTS /
 * PENDING_INVITE_EXISTS) from rejecting a re-run.
 */

const ADMIN_EMAIL = "admin@school.edu";
const ADMIN_PASSWORD = "Admin1234!";
const NEW_PASSWORD = "invitee-password-123";

test.describe("Invite journey (end-to-end)", () => {
  test("happy path: admin invites → invitee sets password → signed in on /students", async ({
    browser,
  }) => {
    const inviteeEmail = `invitee-${Date.now()}@e2e.example.com`;

    // ── Admin context: sign in, create an invite, grab the reveal link ──────
    const adminCtx = await browser.newContext();
    const admin = await adminCtx.newPage();

    await admin.goto("/login");
    await admin.getByLabel("Email").fill(ADMIN_EMAIL);
    await admin.getByLabel("Password").fill(ADMIN_PASSWORD);
    await admin.getByRole("button", { name: /sign in/i }).click();
    await expect(admin).toHaveURL(/\/students/, { timeout: 20000 });

    await admin.goto("/admin/settings");
    await admin.getByRole("button", { name: /invite user/i }).click();

    await admin.getByLabel("Invitee full name").fill("E2E Invitee");
    await admin.getByLabel("Invitee email").fill(inviteeEmail);
    // Role defaults to "teacher" — no need to touch the select.
    await admin.getByRole("button", { name: /create invite/i }).click();

    // Reveal: readonly input carrying `${origin}/invite/${token}`. Target the
    // textbox role so it doesn't collide with the "Copy invite link" button.
    const linkField = admin.getByRole("textbox", { name: "Invite link" });
    await expect(linkField).toBeVisible({ timeout: 20000 });
    const link = await linkField.inputValue();
    const invitePath = new URL(link).pathname;
    expect(invitePath).toMatch(/^\/invite\/[0-9a-f]{64}$/);

    await adminCtx.close();

    // ── Invitee context: fresh + unauthenticated, redeems the token ─────────
    const inviteeCtx = await browser.newContext();
    const invitee = await inviteeCtx.newPage();

    await invitee.goto(invitePath);
    // Valid token → welcome + form, NOT a redirect to /login.
    await expect(invitee.getByText(/welcome/i)).toBeVisible({ timeout: 20000 });
    expect(invitee.url()).toContain(invitePath);

    // Target by placeholder: the create-password input's accessible name is its
    // placeholder (its FormControl wraps the input in a div with the show/hide
    // toggle), so getByLabel won't bind to it.
    await invitee.getByPlaceholder("At least 8 characters").fill(NEW_PASSWORD);
    await invitee.getByPlaceholder("Re-enter password").fill(NEW_PASSWORD);
    await invitee.getByRole("button", { name: /create account/i }).click();

    // Landed signed-in on /students.
    await expect(invitee).toHaveURL(/\/students/, { timeout: 20000 });

    await inviteeCtx.close();
  });

  test("dead token: bogus token renders the non-leaky screen with no form", async ({
    page,
  }) => {
    await page.goto("/invite/deadbeef-not-a-real-token");

    // Non-leaky "not valid" screen (invalid state — the safe default).
    await expect(page.getByText(/isn.t valid/i)).toBeVisible({
      timeout: 20000,
    });
    // The contract that matters: no password form is offered.
    await expect(page.getByPlaceholder("At least 8 characters")).toHaveCount(0);
    // And it was reachable unauthenticated (not bounced to /login).
    expect(page.url()).not.toContain("/login");
  });
});
