/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

/**
 * Sibling links written through `updateStudent` (#89) — the only path the
 * student page uses. A link lives on both students, so every case checks
 * both records.
 */

const modules = import.meta.glob("./**/*.*s");

type TC = TestConvex<typeof schema>;

let t: TC;
let asAdmin: TC;
let asTeacher: TC;
let a: Id<"students">;
let b: Id<"students">;
let c: Id<"students">;

beforeEach(async () => {
  t = convexTest(schema, modules);

  const [adminId, teacherId] = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.insert("users", {
        name: "Admin",
        email: "admin@school.edu",
        role: "admin",
        isActive: true,
      }),
      ctx.db.insert("users", {
        name: "Teacher",
        email: "teacher@school.edu",
        role: "teacher",
        isActive: true,
      }),
    ]),
  );
  asAdmin = t.withIdentity({ subject: `${adminId}|session` }) as TC;
  asTeacher = t.withIdentity({ subject: `${teacherId}|session` }) as TC;

  [a, b, c] = await t.run(async (ctx) =>
    Promise.all(
      ["S-A", "S-B", "S-C"].map((studentNumber) =>
        ctx.db.insert("students", {
          studentNumber,
          createdAt: "2024-01-01T00:00:00.000Z",
        }),
      ),
    ),
  );
});

const siblingsOf = (id: Id<"students">) =>
  t.run(async (ctx) => (await ctx.db.get(id))?.siblingIds ?? []);

const setSiblings = (
  as: TC,
  studentId: Id<"students">,
  siblingIds: Id<"students">[],
) => as.mutation(api.students.updateStudent, { studentId, siblingIds });

describe("updateStudent sibling links", () => {
  it("links on both students", async () => {
    await setSiblings(asAdmin, a, [b]);

    expect(await siblingsOf(a)).toEqual([b]);
    expect(await siblingsOf(b)).toEqual([a]);
  });

  it("unlinks on both students and leaves other links alone", async () => {
    await setSiblings(asAdmin, a, [b, c]);
    await setSiblings(asAdmin, a, [c]);

    expect(await siblingsOf(a)).toEqual([c]);
    expect(await siblingsOf(b)).toEqual([]);
    expect(await siblingsOf(c)).toEqual([a]);
  });

  it("refuses a student as their own sibling and writes nothing", async () => {
    await expect(setSiblings(asAdmin, a, [b, a])).rejects.toThrow(
      "A student cannot be their own sibling",
    );

    expect(await siblingsOf(a)).toEqual([]);
    expect(await siblingsOf(b)).toEqual([]);
  });

  it("stores a repeated sibling once", async () => {
    await setSiblings(asAdmin, a, [b, b]);

    expect(await siblingsOf(a)).toEqual([b]);
    expect(await siblingsOf(b)).toEqual([a]);
  });

  it("refuses a sibling that no longer exists", async () => {
    await t.run((ctx) => ctx.db.delete(c));

    await expect(setSiblings(asAdmin, a, [b, c])).rejects.toThrow(
      "Sibling not found",
    );
    expect(await siblingsOf(a)).toEqual([]);
    expect(await siblingsOf(b)).toEqual([]);
  });

  it("refuses a teacher", async () => {
    await expect(setSiblings(asTeacher, a, [b])).rejects.toThrow();
    expect(await siblingsOf(a)).toEqual([]);
  });
});
