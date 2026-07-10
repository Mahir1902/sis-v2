import { expect, test } from "@playwright/test";

/**
 * /receipts smoke — verifies route protection and the admin-gated page chrome.
 *
 * No authenticated session is used; the page must redirect to /login per
 * `proxy.ts`. Once authenticated tests land (Phase 5), data-shape assertions
 * (filter toolbar, table headers, badges) move into a separate authed spec.
 */

test.describe("/receipts route protection", () => {
  test("unauthenticated visit redirects to /login", async ({ page }) => {
    await page.goto("/receipts");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated visit to a receipt detail also redirects", async ({
    page,
  }) => {
    // Any synthetic receipt id will do — the proxy fires before the page
    // mounts, so the id is never validated against the DB.
    await page.goto("/receipts/abc1234567890123456789012345");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/login");
  });
});
