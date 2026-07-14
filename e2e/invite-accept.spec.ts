import { expect, test } from "@playwright/test";

/**
 * Invite acceptance page (ticket #58) — UI smoke only, matching the repo's
 * backend-free E2E style (smoke.spec.ts). It proves the ONE contract testable
 * without a live Convex backend: the `/invite/<token>` route is reachable
 * UNAUTHENTICATED (proxy `isPublicPage` allowlist), rather than being bounced
 * to /login like every other route.
 *
 * The full happy-path (create invite → set password → land signed-in on
 * /students) and the resolved dead-token screens need a live backend + a real
 * token; those contracts are covered at the seams that don't need deployment
 * env — the pure state logic in lib/inviteStatus.test.ts and the resolver /
 * gate in convex/invites.test.ts.
 */
test.describe("Invite acceptance route", () => {
  test("/invite/<token> is reachable unauthenticated (not redirected to /login)", async ({
    page,
  }) => {
    await page.goto("/invite/some-token");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/invite/some-token");
    expect(page.url()).not.toContain("/login");
  });
});
