/// <reference types="vite/client" />
import migrationsTest from "@convex-dev/migrations/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import { discriptionAction, isSeedGradeBand } from "./deadTables";
import schema from "./schema";

/** Stage 1 of review candidate 4. Deleted with deadTables.ts in stage 2. */

const modules = import.meta.glob("./**/*.*s");

function setup() {
  const t = convexTest(schema, modules);
  migrationsTest.register(t);
  return t;
}

const rule = (name: string, extra: Record<string, string> = {}) => ({
  name,
  discountType: "percentage" as const,
  amount: 10,
  ...extra,
});

afterEach(() => vi.useRealTimers());

describe("discriptionAction", () => {
  it.each([
    [undefined, undefined, "none"],
    ["Kept", undefined, "none"],
    [undefined, "Typo text", "copy"],
    ["  ", "Typo text", "copy"],
    ["Same", " Same ", "drop"],
    ["Kept", "", "drop"],
    [undefined, "   ", "drop"],
    ["Kept", "Other", "conflict"],
  ] as const)("description %j + discription %j → %s", (d, dd, expected) => {
    expect(discriptionAction(d, dd)).toBe(expected);
  });
});

describe("isSeedGradeBand", () => {
  it("accepts a seed band and rejects an edited one", () => {
    const band = { letterGrade: "B", minPercentage: 70, maxPercentage: 79 };
    expect(isSeedGradeBand(band)).toBe(true);
    expect(isSeedGradeBand({ ...band, minPercentage: 65 })).toBe(false);
  });
});

describe("deadTables report + run", () => {
  it("deletes the seed bands, moves discription, and reports zero after", async () => {
    vi.useFakeTimers();
    const t = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("gradeMapping", {
        letterGrade: "A+",
        minPercentage: 90,
        maxPercentage: 100,
        order: 1,
        isActive: true,
      });
      await ctx.db.insert("discountRules", rule("Copy", { discription: "x" }));
      await ctx.db.insert(
        "discountRules",
        rule("Clash", {
          description: "a",
          discription: "b",
        }),
      );
      await ctx.db.insert("discountRules", rule("Clean", { description: "c" }));
    });

    expect(await t.query(internal.deadTables.report, {})).toEqual({
      staff: 0,
      grades: 0,
      advancePayments: 0,
      gradeMapping: { rows: 1, nonSeed: 0 },
      discountRules: { withDiscription: 2, conflicts: ["Clash"] },
    });

    await t.mutation(internal.deadTables.run, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await t.query(internal.deadTables.report, {})).toEqual({
      staff: 0,
      grades: 0,
      advancePayments: 0,
      gradeMapping: { rows: 0, nonSeed: 0 },
      // The conflict is left for a human; stage 2's push fails until fixed.
      discountRules: { withDiscription: 1, conflicts: ["Clash"] },
    });
    const rules = await t.run((ctx) => ctx.db.query("discountRules").collect());
    expect(rules.map((r) => [r.name, r.description, r.discription])).toEqual([
      ["Copy", "x", undefined],
      ["Clash", "a", "b"],
      ["Clean", "c", undefined],
    ]);
  });

  it("refuses to delete an edited grade band", async () => {
    vi.useFakeTimers();
    const t = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("gradeMapping", {
        letterGrade: "A",
        minPercentage: 85,
        maxPercentage: 89,
        order: 2,
        isActive: true,
      });
      await ctx.db.insert("discountRules", rule("Copy", { discription: "x" }));
    });
    expect(
      (await t.query(internal.deadTables.report, {})).gradeMapping.nonSeed,
    ).toBe(1);

    await t.mutation(internal.deadTables.run, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const left = await t.run((ctx) => ctx.db.query("gradeMapping").collect());
    expect(left).toHaveLength(1);
    // The series stops at the throw, so moveDiscription never ran.
    const [r] = await t.run((ctx) => ctx.db.query("discountRules").collect());
    expect(r.discription).toBe("x");
  });
});
