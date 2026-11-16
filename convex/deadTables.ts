import { internal } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import { migrations } from "./migrations";

// ─── Architecture review candidate 4: drop the dead tables (stage 1) ───────
//
// Stage 2 drops `staff`, `gradeMapping`, `grades`, `advancePayments` and
// `discountRules.discription` from the schema and deletes this file. Only the
// `discription` field makes that push fail while data remains: a dropped table
// deploys fine and silently orphans its rows. So `report` is the only gate for
// the four tables. On EVERY deployment, before stage 2 merges:
//
//   1. npx convex run deadTables:report
//        staff / grades / advancePayments and gradeMapping.nonSeed must be 0.
//        Anything else is real data: stop and report it, don't delete it.
//   2. npx convex run deadTables:run '{"dryRun":true}'
//   3. npx convex run deadTables:run
//   4. npx convex run deadTables:report   # every count 0, conflicts []
//
// Trust step 4, not the migration status: a discount rule whose two
// descriptions disagree is skipped, and the run still reports "done". A
// finished run won't run again, so after a manual fix or a reseed use
//   npx convex run deadTables:run '{"reset":true}'   # both steps idempotent

/** The bands `seedReferenceData` used to insert. Any other row is real data. */
const SEED_GRADE_BANDS: [string, number, number][] = [
  ["A+", 90, 100],
  ["A", 80, 89],
  ["B", 70, 79],
  ["C", 60, 69],
  ["D", 50, 59],
  ["F", 0, 49],
];

/** True when a `gradeMapping` row is one of the untouched seed bands. */
export function isSeedGradeBand(row: {
  letterGrade: string;
  minPercentage: number;
  maxPercentage: number;
}): boolean {
  return SEED_GRADE_BANDS.some(
    ([letter, min, max]) =>
      row.letterGrade === letter &&
      row.minPercentage === min &&
      row.maxPercentage === max,
  );
}

/**
 * What happens to a discount rule's v1 typo field `discription`:
 *  - "none": no typo field;
 *  - "copy": `description` is empty, so it takes the typo field's text;
 *  - "drop": the typo field is empty or says the same, so it just goes;
 *  - "conflict": both hold different text — left alone for a human.
 */
export function discriptionAction(
  description: string | undefined,
  discription: string | undefined,
): "none" | "copy" | "drop" | "conflict" {
  if (discription === undefined) return "none";
  const kept = description?.trim() ?? "";
  const legacy = discription.trim();
  if (legacy === "" || legacy === kept) return "drop";
  if (kept === "") return "copy";
  return "conflict";
}

// ponytail: counts cap at 1000; any non-zero count stops the rollout anyway.
const CAP = 1000;

/**
 * Read-only gate for stage 2. Row counts per dropped table, plus the discount
 * rules still carrying `discription` and the names of conflicting ones (fix
 * those by hand in the dashboard, then `run` with `{"reset":true}`).
 */
export const report = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [staff, gradeMapping, grades, advancePayments, rules] =
      await Promise.all([
        ctx.db.query("staff").take(CAP),
        ctx.db.query("gradeMapping").take(CAP),
        ctx.db.query("grades").take(CAP),
        ctx.db.query("advancePayments").take(CAP),
        ctx.db.query("discountRules").take(CAP),
      ]);
    const withDiscription = rules.filter(
      (r) => discriptionAction(r.description, r.discription) !== "none",
    );
    return {
      staff: staff.length,
      grades: grades.length,
      advancePayments: advancePayments.length,
      gradeMapping: {
        rows: gradeMapping.length,
        nonSeed: gradeMapping.filter((r) => !isSeedGradeBand(r)).length,
      },
      discountRules: {
        withDiscription: withDiscription.length,
        conflicts: withDiscription
          .filter(
            (r) =>
              discriptionAction(r.description, r.discription) === "conflict",
          )
          .map((r) => r.name),
      },
    };
  },
});

/**
 * Deletes the seeded `gradeMapping` rows. Throws on a row that isn't an exact
 * seed band (an edited band is real data); the 6 seed rows fit one batch, so
 * nothing is deleted in that case. Idempotent.
 */
export const deleteSeedGradeMapping = migrations.define({
  table: "gradeMapping",
  migrateOne: async (ctx, row) => {
    if (!isSeedGradeBand(row)) {
      throw new Error(`gradeMapping ${row._id} is not a seed band; stop`);
    }
    await ctx.db.delete(row._id);
  },
});

/** Moves `discountRules.discription` into an empty `description`. Idempotent. */
export const moveDiscription = migrations.define({
  table: "discountRules",
  migrateOne: (_ctx, rule) => {
    const action = discriptionAction(rule.description, rule.discription);
    if (action === "copy") {
      return { description: rule.discription?.trim(), discription: undefined };
    }
    if (action === "drop") return { discription: undefined };
  },
});

export const run = migrations.runner([
  internal.deadTables.deleteSeedGradeMapping,
  internal.deadTables.moveDiscription,
]);
