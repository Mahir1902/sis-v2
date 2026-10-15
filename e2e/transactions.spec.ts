import { expect, test } from "@playwright/test";

/**
 * /admin/transactions route protection — the unauthenticated redirect only.
 *
 * This file used to also carry 12 filter-structure tests. Every one of them
 * opened the page unauthenticated, hit `proxy.ts`'s redirect, and called
 * `test.skip` — so none of them ever asserted anything, and the suite reported
 * them as not-failed rather than not-run. They were deleted rather than
 * repaired: the filter bar's real coverage is cheap at the seam
 * (`lib/receiptsListFilter.test.ts` and friends), and an authenticated E2E
 * pass over the same DOM is the expensive way to learn less.
 */

test.describe("/admin/transactions route protection", () => {
  test("unauthenticated visit redirects to /login", async ({ page }) => {
    await page.goto("/admin/transactions");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/login");
  });
});
