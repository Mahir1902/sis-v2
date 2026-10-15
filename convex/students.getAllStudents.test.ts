/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

/**
 * The status filter on the students list (#95). Imported rows can have no
 * status at all (#93); they must be reachable through the "unspecified"
 * sentinel and must not leak into any real-status filter.
 */

const modules = import.meta.glob("./**/*.*s");

type TC = TestConvex<typeof schema>;

let t: TC;
let asAdmin: TC;
let levelId: Id<"standardLevels">;
let yearId: Id<"academicYears">;

beforeEach(async () => {
  t = convexTest(schema, modules);

  const adminId = await t.run(async (ctx) => {
    levelId = await ctx.db.insert("standardLevels", {
      name: "Grade 1",
      code: "01",
    });
    yearId = await ctx.db.insert("academicYears", {
      name: "2024-2025",
      startDate: 0,
      endDate: 1,
    });
    return ctx.db.insert("users", {
      name: "Admin",
      email: "admin@school.edu",
      role: "admin",
      isActive: true,
    });
  });

  asAdmin = t.withIdentity({ subject: `${adminId}|session` }) as TC;

  await t.run(async (ctx) => {
    await ctx.db.insert("students", {
      studentNumber: "S-ACTIVE",
      studentFullName: "Active Student",
      standardLevel: levelId,
      academicYear: yearId,
      status: "active",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    await ctx.db.insert("students", {
      studentNumber: "S-GRAD",
      studentFullName: "Graduated Student",
      standardLevel: levelId,
      academicYear: yearId,
      status: "graduated",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    // Imported row: no status, no name.
    await ctx.db.insert("students", {
      studentNumber: "S-IMPORTED",
      standardLevel: levelId,
      academicYear: yearId,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  });
});

const numbers = (rows: { studentNumber: string }[]) =>
  rows.map((r) => r.studentNumber).sort();

describe("getAllStudents status filter", () => {
  it("returns every student, status or not, when unfiltered", async () => {
    const rows = await asAdmin.query(api.students.getAllStudents, {});
    expect(numbers(rows)).toEqual(["S-ACTIVE", "S-GRAD", "S-IMPORTED"]);
  });

  it("returns exactly the status-less students for 'unspecified'", async () => {
    const rows = await asAdmin.query(api.students.getAllStudents, {
      status: ["unspecified"],
    });
    expect(numbers(rows)).toEqual(["S-IMPORTED"]);
  });

  it("leaves real status filters unchanged", async () => {
    const rows = await asAdmin.query(api.students.getAllStudents, {
      status: ["active"],
    });
    expect(numbers(rows)).toEqual(["S-ACTIVE"]);
  });

  it("combines the sentinel with a real status", async () => {
    const rows = await asAdmin.query(api.students.getAllStudents, {
      status: ["graduated", "unspecified"],
    });
    expect(numbers(rows)).toEqual(["S-GRAD", "S-IMPORTED"]);
  });
});
