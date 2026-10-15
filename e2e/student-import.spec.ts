import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * End-to-end Excel student import (ticket #100) — spec #91's seam 3.
 *
 * Runs against a LIVE dev deployment (`npm run dev` + a Convex deployment that
 * has had the schema deployed, `seed:backfillAcademicYears` run, and the seeded
 * admin `admin@school.edu`). One journey, deliberately not a matrix: the matrix
 * is the transform module's unit tests, and duplicating it here would buy
 * runtime and nothing else.
 *
 *  1. Upload the school's real sample file → the preview states the split →
 *     the issues CSV downloads → commit → the summary states created /
 *     updated / skipped.
 *  2. A non-admin account is denied the route.
 *
 * The sample file is real student PII and therefore gitignored (see
 * `.gitignore`), so this spec skips when it is absent — i.e. everywhere but a
 * developer's machine. Nothing below asserts on a child's name or number;
 * aggregate counts only.
 *
 * Deleted alongside the import surface at spec #91's exit condition.
 */

const SAMPLE_FILE = path.resolve(
  __dirname,
  "../assets/Student's Data Class 3,4 & 5 for Mahir.xlsx",
);

/**
 * What the sample file is, independent of the database behind it: 3 tabs,
 * 30 data rows, and none rejectable against fully-seeded reference data.
 *
 * 12 warnings land on 11 rows — the 10 `Class-3` rows whose stated class
 * disagrees with the tab name, plus 2 phone numbers that are not 11 digits,
 * one of which sits on a `Class-3` row and so carries both. The row count and
 * the warning count therefore differ, and the CSV is keyed to the latter.
 *
 * The new-vs-update split is deliberately NOT pinned: it is a fact about the
 * deployment, not about the file. `insert + update` is, and that is what the
 * commit button states.
 */
const TOTAL_ROWS = 30;
const WARNED_ROWS = 11;
const TOTAL_WARNINGS = 12;

/** §7.5's column set, written out rather than imported — the spec is the
 * independent source of truth for it, not `lib/studentImportFile.ts`. */
const ISSUES_CSV_HEADER =
  "severity,sheet,excelRow,studentId,column,value,reason";

const ADMIN_EMAIL = "admin@school.edu";
const ADMIN_PASSWORD = "Admin1234!";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/students/, { timeout: 20000 });
}

/** A filter chip renders `${label} ${count}` — the preview's counts on screen. */
const chip = (page: Page, label: string, count: number) =>
  page.getByRole("button", { name: `${label} ${count}`, exact: true });

test.describe("Excel student import (end-to-end)", () => {
  test("admin uploads the sample file, downloads the issues CSV, and commits it", async ({
    page,
  }) => {
    // Only this test needs the file — the denial test below runs everywhere.
    test.skip(
      !existsSync(SAMPLE_FILE),
      "Skipped: the sample student data file is gitignored PII and is not present.",
    );

    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin/import-students");

    // react-dropzone's input is hidden; setInputFiles drives it regardless.
    await page
      .getByLabel("Choose the student data file")
      .setInputFiles(SAMPLE_FILE);

    // ── The preview states the split ────────────────────────────────────────
    await expect(chip(page, "All", TOTAL_ROWS)).toBeVisible({ timeout: 30000 });
    await expect(chip(page, "Warned", WARNED_ROWS)).toBeVisible();
    // Zero rejections is the assertion that fails on a deployment missing the
    // academic-year backfill — every pre-2021 row would reject on its year.
    await expect(chip(page, "Rejected", 0)).toBeVisible();

    // The button carries insert + update, which must account for every row —
    // so its own label is the assertion that the split adds up.
    const commit = page.getByRole("button", {
      name: `Import ${TOTAL_ROWS} rows`,
    });
    await expect(commit).toBeVisible();

    // ── The issues CSV downloads ────────────────────────────────────────────
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /issues csv/i }).click(),
    ]);
    const csvPath = await download.path();
    const lines = readFileSync(csvPath, "utf8").trimEnd().split("\n");
    expect(lines[0]).toBe(ISSUES_CSV_HEADER);
    // Warnings are in the CSV, told apart by the severity column rather than
    // left out (§7.5) — so a file with nothing rejected still yields an
    // artifact, and one line per warning is what proves it.
    expect(lines).toHaveLength(1 + TOTAL_WARNINGS);

    // ── Commit, and the summary states the split ────────────────────────────
    await commit.click();

    // Scoped to the page: the Sonner toast carries the same sentence.
    const summary = page
      .getByRole("main")
      .getByText(/\d+ created · \d+ updated · \d+ skipped/);
    await expect(summary).toBeVisible({ timeout: 60000 });

    const text = (await summary.textContent()) ?? "";
    const [, created, updated, skipped] =
      /(\d+) created · (\d+) updated · (\d+) skipped/.exec(text) ?? [];
    // Idempotent upsert: a first run is all creates, a re-run all updates, and
    // either way every valid row is accounted for and nothing is skipped.
    expect(Number(created) + Number(updated)).toBe(TOTAL_ROWS);
    expect(Number(skipped)).toBe(0);
  });

  test("a non-admin account is denied the import surface", async ({
    browser,
  }) => {
    // No non-admin is seeded, so mint one through the invite flow — the same
    // path a real teacher account is created by (prior art:
    // `e2e/invite-accept.spec.ts`). A unique email per run keeps the
    // ACCOUNT_EXISTS / PENDING_INVITE_EXISTS guards from rejecting a re-run,
    // at the cost of one leftover teacher account per run — the same trade
    // `invite-accept.spec.ts` already makes on this deployment.
    const teacherEmail = `import-e2e-${Date.now()}@e2e.example.com`;
    const teacherPassword = "teacher-password-123";

    const adminCtx = await browser.newContext();
    const admin = await adminCtx.newPage();
    await signIn(admin, ADMIN_EMAIL, ADMIN_PASSWORD);

    await admin.goto("/admin/settings");
    await admin.getByRole("button", { name: /invite user/i }).click();
    await admin.getByLabel("Invitee full name").fill("E2E Import Teacher");
    await admin.getByLabel("Invitee email").fill(teacherEmail);
    // Role defaults to "teacher" — the non-admin this test needs.
    await admin.getByRole("button", { name: /create invite/i }).click();

    const linkField = admin.getByRole("textbox", { name: "Invite link" });
    await expect(linkField).toBeVisible({ timeout: 20000 });
    const invitePath = new URL(await linkField.inputValue()).pathname;
    await adminCtx.close();

    // Fresh context: the proxy bounces authenticated users off /invite/*.
    const teacherCtx = await browser.newContext();
    const teacher = await teacherCtx.newPage();
    await teacher.goto(invitePath);
    await teacher
      .getByPlaceholder("At least 8 characters")
      .fill(teacherPassword);
    await teacher.getByPlaceholder("Re-enter password").fill(teacherPassword);
    await teacher.getByRole("button", { name: /create account/i }).click();
    await expect(teacher).toHaveURL(/\/students/, { timeout: 20000 });

    await teacher.goto("/admin/import-students");

    // `RoleGate` is a UI guard only; the backend gate on every function in
    // `convex/studentImport.ts` is covered at seam 2 (`convex/studentImport.test.ts`).
    await expect(teacher.getByText("Access Denied")).toBeVisible({
      timeout: 20000,
    });
    // The gate is the point: no dropzone, so no file can be picked at all.
    await expect(
      teacher.getByLabel("Choose the student data file"),
    ).toHaveCount(0);

    await teacherCtx.close();
  });
});
