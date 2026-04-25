import { expect, test } from "@playwright/test";

/**
 * Smoke tests — verify the app routes and UI are functional.
 * These tests run against a live dev server (http://localhost:3001).
 *
 * NOTE: These are UI tests only. They do not rely on a real Convex backend.
 * Convex queries that return undefined (loading) are handled by skeletons.
 */

test.describe("Authentication", () => {
  test("login page is accessible at /login", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    // The login page should be at /login (not redirected away)
    expect(page.url()).toContain("/login");
  });

  test("login page renders the SIS heading", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    // CardTitle text — use first() to avoid strict mode issues with multiple matches
    await expect(
      page.getByText("School Information System").first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test("login page renders email and password input fields", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    // Target the actual input elements by role and name to avoid strict-mode violations
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible({
      timeout: 8000,
    });
  });

  test("login page renders Sign In button", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible({
      timeout: 8000,
    });
  });

  test("login form shows validation errors on empty submit", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /sign in/i }).click();
    // React Hook Form + Zod validation errors — FormMessage renders as <p data-slot="form-message">
    // The fields turn aria-invalid and error messages appear
    await expect(
      page.locator("[data-slot='form-message']").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("root page loads without crashing", async ({ page }) => {
    const response = await page.goto("/");
    // Should return a 200 — even if it's the scaffold page or dashboard
    expect(response?.status()).toBe(200);
  });
});
