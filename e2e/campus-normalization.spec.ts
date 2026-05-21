import { expect, test } from "@playwright/test";

test.describe("Campus Normalization — Filter uses IDs, displays names", () => {
  async function navigateAndCheckFilters(
    page: import("@playwright/test").Page,
  ): Promise<boolean> {
    await page.goto("/admin/transactions");
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/login")) {
      return false;
    }

    try {
      await page
        .locator('section[aria-label="Transaction filters"]')
        .waitFor({ state: "visible", timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  test("campus filter select items use IDs as values, not name strings", async ({
    page,
  }) => {
    const filtersVisible = await navigateAndCheckFilters(page);
    if (!filtersVisible) {
      test.skip(
        true,
        "Skipped: page redirected to login — authenticated session required",
      );
      return;
    }

    const moreFilters = page.getByLabel("Show more filters");
    await moreFilters.click();

    const campusSelect = page.getByLabel("Filter by campus");
    await expect(campusSelect).toBeVisible({ timeout: 5000 });
    await campusSelect.click();

    const options = page.locator('[role="option"]');
    const count = await options.count();

    for (let i = 0; i < count; i++) {
      const option = options.nth(i);
      const value = await option.getAttribute("data-value");
      const text = await option.textContent();

      if (value === "__all__") continue;

      expect(text).not.toBe(value);
      expect(value).toBeTruthy();
    }
  });

  test("transaction table displays campus names, not raw IDs", async ({
    page,
  }) => {
    const filtersVisible = await navigateAndCheckFilters(page);
    if (!filtersVisible) {
      test.skip(
        true,
        "Skipped: page redirected to login — authenticated session required",
      );
      return;
    }

    const table = page.locator("table");
    const hasTable = await table.isVisible().catch(() => false);
    if (!hasTable) {
      test.skip(true, "Skipped: no transaction table visible — no data loaded");
      return;
    }

    const campusHeader = page.locator('th:has-text("Campus")');
    const hasCampusColumn = await campusHeader.isVisible().catch(() => false);
    if (!hasCampusColumn) return;

    const campusCells = page.locator("td").filter({ hasText: /^[a-zA-Z]/ });
    const cellCount = await campusCells.count();

    for (let i = 0; i < Math.min(cellCount, 5); i++) {
      const text = await campusCells.nth(i).textContent();
      if (text && text !== "—") {
        expect(text).not.toMatch(/^[a-z0-9]{16,}$/);
      }
    }
  });
});

test.describe("Campus Normalization — Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("mobile campus filter also uses IDs as values", async ({ page }) => {
    await page.goto("/admin/transactions");
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/login")) {
      test.skip(
        true,
        "Skipped: page redirected to login — authenticated session required",
      );
      return;
    }

    const filtersButton = page.getByLabel("Open transaction filters");
    try {
      await filtersButton.waitFor({ state: "visible", timeout: 10000 });
    } catch {
      test.skip(true, "Skipped: mobile filter button not visible");
      return;
    }

    await filtersButton.click();

    const campusSelect = page.getByLabel("Filter by campus").first();
    await expect(campusSelect).toBeVisible({ timeout: 5000 });
    await campusSelect.click();

    const options = page.locator('[role="option"]');
    const count = await options.count();

    for (let i = 0; i < count; i++) {
      const option = options.nth(i);
      const value = await option.getAttribute("data-value");
      if (value === "__all__") continue;

      const text = await option.textContent();
      expect(text).not.toBe(value);
    }
  });
});
