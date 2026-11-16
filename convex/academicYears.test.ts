/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { dhakaDate } from "../lib/attendanceDate";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveCurrentAcademicYear } from "./lib/academicYear";
import schema from "./schema";

/**
 * The current academic year (architecture review candidate 3): exactly one
 * year covering today's Dhaka-local day, else none — never a guess.
 */

const modules = import.meta.glob("./**/*.*s");
type TC = TestConvex<typeof schema>;

/** Dhaka-local midnight of a "YYYY-MM-DD" day, as the calendar page stores it. */
const dhakaMidnight = (day: string) => Date.parse(`${day}T00:00:00+06:00`);
/** UTC midnight, as `seed.ts` and the promotions page store it. */
const utcMidnight = (day: string) => Date.parse(`${day}T00:00:00Z`);

let n = 0;
const year = (
  name: string,
  startDate: number,
  endDate: number,
): Doc<"academicYears"> => ({
  _id: `y${n++}` as Id<"academicYears">,
  _creationTime: 0,
  name,
  startDate,
  endDate,
});

const y2526 = year(
  "2025-2026",
  dhakaMidnight("2025-06-01"),
  dhakaMidnight("2026-05-20"),
);
const y2627 = year(
  "2026-2027",
  dhakaMidnight("2026-06-01"),
  dhakaMidnight("2027-05-31"),
);
const resolve = (today: string, years = [y2526, y2627]) =>
  resolveCurrentAcademicYear(years, today);

describe("resolveCurrentAcademicYear", () => {
  it("picks the one year containing the day", () => {
    expect(resolve("2026-11-10")).toEqual({ status: "current", year: y2627 });
  });

  it("returns none in a gap, before the first and after the last year — never the latest", () => {
    expect(resolve("2026-05-25")).toEqual({ status: "none" });
    expect(resolve("2020-01-01")).toEqual({ status: "none" });
    expect(resolve("2030-01-01")).toEqual({ status: "none" });
    expect(resolve("2026-11-10", [])).toEqual({ status: "none" });
  });

  it("includes the first and last day, and nothing after", () => {
    expect(resolve("2026-06-01")).toMatchObject({ year: y2627 });
    expect(resolve("2026-05-20")).toMatchObject({ year: y2526 });
    expect(resolve("2026-05-21")).toEqual({ status: "none" });
  });

  it("reads the bounds as Dhaka-local days, the way attendance.date is stored", () => {
    // Seed-style bounds (UTC midnight = 06:00 Dhaka) label the same day.
    const seeded = year(
      "2024-2025",
      utcMidnight("2024-06-01"),
      utcMidnight("2025-05-31"),
    );
    expect(resolve("2025-05-31", [seeded])).toMatchObject({ year: seeded });

    // 31 May 19:00 UTC is already 1 June in Dhaka: past the year's end,
    // although the UTC calendar day is still inside it.
    const lateEvening = Date.UTC(2025, 4, 31, 19, 0);
    expect(new Date(lateEvening).toISOString().slice(0, 10)).toBe("2025-05-31");
    expect(resolve(dhakaDate(lateEvening), [seeded])).toEqual({
      status: "none",
    });
  });

  it("reports overlapping years instead of picking one, oldest first", () => {
    // The seeded pattern: 1 June → 31 July of the next year.
    const a = year(
      "2025-2026",
      utcMidnight("2025-06-01"),
      utcMidnight("2026-07-31"),
    );
    const b = year(
      "2026-2027",
      utcMidnight("2026-06-01"),
      utcMidnight("2027-07-31"),
    );
    expect(resolve("2026-07-15", [b, a])).toEqual({
      status: "overlap",
      years: [a, b],
    });
    expect(resolve("2026-08-01", [b, a])).toMatchObject({ year: b });
  });
});

describe("academicYears functions", () => {
  let t: TC;
  let asAdmin: TC;

  beforeEach(async () => {
    t = convexTest(schema, modules);
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Admin",
        email: "admin@school.edu",
        role: "admin",
        isActive: true,
      }),
    );
    asAdmin = t.withIdentity({ subject: `${adminId}|s` }) as TC;
  });

  it("getCurrent answers from the server's today, for a signed-in caller", async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    await t.run((ctx) =>
      ctx.db.insert("academicYears", {
        name: "Past",
        startDate: now - 400 * DAY,
        endDate: now - 40 * DAY,
      }),
    );
    const id = await t.run((ctx) =>
      ctx.db.insert("academicYears", {
        name: "This",
        startDate: now - 30 * DAY,
        endDate: now + 300 * DAY,
      }),
    );
    expect(await asAdmin.query(api.academicYears.getCurrent, {})).toMatchObject(
      { status: "current", year: { _id: id } },
    );
    await expect(t.query(api.academicYears.getCurrent, {})).rejects.toThrow(
      "Unauthenticated",
    );
  });

  it("create rejects a year sharing a day with another", async () => {
    await asAdmin.mutation(api.academicYears.create, {
      name: "2026-2027",
      startDate: utcMidnight("2026-06-01"),
      endDate: utcMidnight("2027-05-31"),
    });
    await expect(
      asAdmin.mutation(api.academicYears.create, {
        name: "2027-2028",
        startDate: utcMidnight("2027-05-31"),
        endDate: utcMidnight("2028-05-31"),
      }),
    ).rejects.toThrow(/overlap 2026-2027/);
    await asAdmin.mutation(api.academicYears.create, {
      name: "2027-2028",
      startDate: utcMidnight("2027-06-01"),
      endDate: utcMidnight("2028-05-31"),
    });
  });

  it("update rejects a date change that adds an overlap, but lets a seeded overlap be fixed", async () => {
    const [a, b, c] = await t.run(async (ctx) =>
      Promise.all(
        [2025, 2026, 2027].map((y) =>
          ctx.db.insert("academicYears", {
            name: `${y}-${y + 1}`,
            startDate: utcMidnight(`${y}-06-01`),
            endDate: utcMidnight(`${y + 1}-07-31`), // seeded June–July overlap
          }),
        ),
      ),
    );

    // b still overlaps c (it already did); trimming its end must not be blocked.
    await asAdmin.mutation(api.academicYears.update, {
      academicYearId: b,
      endDate: utcMidnight("2027-05-31"),
    });
    // Stretching a back over c's dates adds an overlap it never had.
    await expect(
      asAdmin.mutation(api.academicYears.update, {
        academicYearId: a,
        endDate: utcMidnight("2027-07-01"),
      }),
    ).rejects.toThrow(/overlap 2027-2028/);
    // Name-only edits never trip the date guard.
    await asAdmin.mutation(api.academicYears.update, {
      academicYearId: c,
      name: "2027-28",
    });
  });
});
