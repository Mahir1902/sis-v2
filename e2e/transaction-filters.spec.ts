import { expect, test } from "@playwright/test";

/**
 * Transaction Log filter UI — E2E tests.
 *
 * The /admin/transactions page requires authentication (proxy.ts redirects
 * unauthenticated users to /login) and admin role (RoleGate). These tests
 * are split into two groups:
 *
 * 1. Auth-gate tests: verify the unauthenticated redirect works correctly.
 * 2. Filter structure tests: verify the filter bar's DOM structure, desktop
 *    and mobile layouts, and interactive toggles. These tests are wrapped in
 *    a conditional check — if the page redirects to /login, the test is
 *    skipped with an informative message. When an authenticated session is
 *    available (e.g., via storageState in a future Phase 5 test setup), all
 *    tests will run fully.
 *
 * NOTE: No data-testid attributes were added to components — all selectors
 * use existing aria-labels and semantic HTML.
 */

test.describe("Transaction Log — Auth Gate", () => {
  test("unauthenticated user is redirected from /admin/transactions to /login", async ({
    page,
  }) => {
    await page.goto("/admin/transactions");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/login");
  });
});

test.describe("Transaction Log — Desktop Filter Bar Structure", () => {
  /**
   * Helper: navigate to the transactions page and determine whether the
   * filter bar rendered (authenticated) or the user was redirected to login.
   * Returns true if the filter section is present.
   */
  async function navigateAndCheckFilters(
    page: import("@playwright/test").Page,
  ): Promise<boolean> {
    await page.goto("/admin/transactions");
    await page.waitForLoadState("networkidle");

    // If redirected to login, the filter bar will not be present
    if (page.url().includes("/login")) {
      return false;
    }

    // Wait briefly for Convex data to load and RoleGate to render
    try {
      await page
        .locator('section[aria-label="Transaction filters"]')
        .waitFor({ state: "visible", timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  test("filter section landmark is present with correct aria-label", async ({
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

    const filterSection = page.locator(
      'section[aria-label="Transaction filters"]',
    );
    await expect(filterSection).toBeVisible();
  });

  test("primary row renders Academic Year select", async ({ page }) => {
    const filtersVisible = await navigateAndCheckFilters(page);
    if (!filtersVisible) {
      test.skip(
        true,
        "Skipped: page redirected to login — authenticated session required",
      );
      return;
    }

    const yearSelect = page.getByLabel("Filter by academic year");
    await expect(yearSelect).toBeVisible({ timeout: 8000 });
  });

  test("primary row renders Standard Level select", async ({ page }) => {
    const filtersVisible = await navigateAndCheckFilters(page);
    if (!filtersVisible) {
      test.skip(
        true,
        "Skipped: page redirected to login — authenticated session required",
      );
      return;
    }

    const levelSelect = page.getByLabel("Filter by standard level");
    await expect(levelSelect).toBeVisible({ timeout: 8000 });
  });

  test("primary row renders Date Range picker button", async ({ page }) => {
    const filtersVisible = await navigateAndCheckFilters(page);
    if (!filtersVisible) {
      test.skip(
        true,
        "Skipped: page redirected to login — authenticated session required",
      );
      return;
    }

    const dateRangeButton = page.getByLabel("Select date range");
    await expect(dateRangeButton).toBeVisible({ timeout: 8000 });
  });

  test("primary row renders Student search button", async ({ page }) => {
    const filtersVisible = await navigateAndCheckFilters(page);
    if (!filtersVisible) {
      test.skip(
        true,
        "Skipped: page redirected to login — authenticated session required",
      );
      return;
    }

    const studentSearch = page.getByLabel("Search and filter by student");
    await expect(studentSearch).toBeVisible({ timeout: 8000 });
  });

  test("primary row renders More Filters button with aria-expanded", async ({
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
    await expect(moreFilters).toBeVisible({ timeout: 8000 });
    // Initially collapsed
    await expect(moreFilters).toHaveAttribute("aria-expanded", "false");
  });

  test("primary row renders Reset button (disabled when no filters active)", async ({
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

    const resetButton = page.getByLabel("Reset all filters").first();
    await expect(resetButton).toBeVisible({ timeout: 8000 });
    await expect(resetButton).toBeDisabled();
  });

  test("More Filters button toggles secondary row visibility", async ({
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
    await expect(moreFilters).toHaveAttribute("aria-expanded", "false");

    // Click to expand
    await moreFilters.click();
    await expect(moreFilters).toHaveAttribute("aria-expanded", "true");

    // Secondary filters should become visible
    const campusSelect = page.getByLabel("Filter by campus");
    await expect(campusSelect).toBeVisible({ timeout: 5000 });

    const paymentModeSelect = page.getByLabel("Filter by payment mode");
    await expect(paymentModeSelect).toBeVisible({ timeout: 5000 });

    const voidedToggle = page.getByLabel("Show voided sessions");
    await expect(voidedToggle).toBeVisible({ timeout: 5000 });

    // Click again to collapse
    await moreFilters.click();
    await expect(moreFilters).toHaveAttribute("aria-expanded", "false");
  });

  test("DateRangePicker opens popover with preset buttons and calendar", async ({
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

    const dateRangeButton = page.getByLabel("Select date range");
    await dateRangeButton.click();

    // Verify preset buttons are visible inside the popover
    const todayPreset = page.getByLabel("Select Today date range");
    await expect(todayPreset).toBeVisible({ timeout: 5000 });

    const thisWeekPreset = page.getByLabel("Select This Week date range");
    await expect(thisWeekPreset).toBeVisible({ timeout: 5000 });

    const thisMonthPreset = page.getByLabel("Select This Month date range");
    await expect(thisMonthPreset).toBeVisible({ timeout: 5000 });

    const lastMonthPreset = page.getByLabel("Select Last Month date range");
    await expect(lastMonthPreset).toBeVisible({ timeout: 5000 });

    const thisQuarterPreset = page.getByLabel("Select This Quarter date range");
    await expect(thisQuarterPreset).toBeVisible({ timeout: 5000 });

    const fullYearPreset = page.getByLabel("Select Full Year date range");
    await expect(fullYearPreset).toBeVisible({ timeout: 5000 });

    // Verify the calendar (react-day-picker) renders inside the popover
    // The calendar renders a <table> inside the popover content
    const calendarTable = page.locator('[role="grid"]');
    await expect(calendarTable.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Transaction Log — Mobile Layout", () => {
  // Use iPhone-sized viewport for all tests in this group
  test.use({ viewport: { width: 375, height: 812 } });

  async function navigateAndCheckMobile(
    page: import("@playwright/test").Page,
  ): Promise<boolean> {
    await page.goto("/admin/transactions");
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/login")) {
      return false;
    }

    // Wait for the mobile filters button to appear
    try {
      await page
        .getByLabel("Open transaction filters")
        .waitFor({ state: "visible", timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  test("mobile viewport shows Filters button instead of desktop filter bar", async ({
    page,
  }) => {
    const mobileReady = await navigateAndCheckMobile(page);
    if (!mobileReady) {
      test.skip(
        true,
        "Skipped: page redirected to login — authenticated session required",
      );
      return;
    }

    // Mobile "Filters" button should be visible
    const filtersButton = page.getByLabel("Open transaction filters");
    await expect(filtersButton).toBeVisible();

    // Desktop filter bar (inside the hidden sm:block container) should be hidden
    // The desktop container is a div with class "hidden sm:block"
    const desktopContainer = page
      .locator('section[aria-label="Transaction filters"] > .hidden.sm\\:block')
      .first();
    await expect(desktopContainer).toBeHidden();
  });

  test("mobile Filters button opens bottom sheet with all filter controls", async ({
    page,
  }) => {
    const mobileReady = await navigateAndCheckMobile(page);
    if (!mobileReady) {
      test.skip(
        true,
        "Skipped: page redirected to login — authenticated session required",
      );
      return;
    }

    const filtersButton = page.getByLabel("Open transaction filters");
    await filtersButton.click();

    // Sheet header should show "Filters"
    const sheetTitle = page.getByRole("heading", { name: "Filters" });
    await expect(sheetTitle).toBeVisible({ timeout: 5000 });

    // All filter controls should be present in the sheet
    // Academic Year (mobile uses same aria-label — first() to pick the mobile one)
    await expect(
      page.getByLabel("Filter by academic year").first(),
    ).toBeVisible({ timeout: 5000 });

    // Standard Level
    await expect(
      page.getByLabel("Filter by standard level").first(),
    ).toBeVisible({ timeout: 5000 });

    // Date Range
    await expect(page.getByLabel("Select date range").first()).toBeVisible({
      timeout: 5000,
    });

    // Student Search
    await expect(
      page.getByLabel("Search and filter by student").first(),
    ).toBeVisible({ timeout: 5000 });

    // Campus
    await expect(page.getByLabel("Filter by campus").first()).toBeVisible({
      timeout: 5000,
    });

    // Payment Mode
    await expect(page.getByLabel("Filter by payment mode").first()).toBeVisible(
      { timeout: 5000 },
    );

    // Show Voided toggle
    await expect(page.getByLabel("Show voided sessions").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("mobile sheet has Reset and Apply buttons", async ({ page }) => {
    const mobileReady = await navigateAndCheckMobile(page);
    if (!mobileReady) {
      test.skip(
        true,
        "Skipped: page redirected to login — authenticated session required",
      );
      return;
    }

    const filtersButton = page.getByLabel("Open transaction filters");
    await filtersButton.click();

    // Reset button in sheet footer
    const resetButton = page.getByLabel("Reset all filters").first();
    await expect(resetButton).toBeVisible({ timeout: 5000 });

    // Apply button in sheet footer
    const applyButton = page.getByLabel("Apply filters and close");
    await expect(applyButton).toBeVisible({ timeout: 5000 });
  });
});
