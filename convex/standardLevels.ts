import { query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

/** Progression order of level codes (PG → Grade 12). */
export const LEVEL_CODE_ORDER = [
  "PG",
  "NUR",
  "KG1",
  "KG2",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
];

/** List all standard levels in progression order (PG → Grade 12). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "teacher", "student"]);
    const levels = await ctx.db.query("standardLevels").take(100);

    // Sort by walking the linked list from the root (level with no predecessor)
    const nextIdSet = new Set(levels.map((l) => l.nextLevelId).filter(Boolean));
    const _root = levels.find(
      (l) =>
        !nextIdSet.has(l._id) &&
        levels.some(
          (x) =>
            x.nextLevelId === l._id ||
            !levels.find((x2) => x2.nextLevelId === l._id),
        ),
    );

    // Fallback: sort by code if linked list walk fails
    return levels.sort(
      (a, b) =>
        LEVEL_CODE_ORDER.indexOf(a.code) - LEVEL_CODE_ORDER.indexOf(b.code),
    );
  },
});
