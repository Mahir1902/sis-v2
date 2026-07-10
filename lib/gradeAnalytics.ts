/**
 * Pure math for the Phase B class analytics (ADR-0005). Difficulty is cancelled
 * by comparing a student only to classmates who sat the same papers, so every
 * function here works on already-collected renormalized values — no DB access.
 * The Convex queries in `convex/computedGrades.ts` do the reads + active-peer
 * filtering, then hand arrays to these helpers.
 */

/**
 * Standard competition ranking ("1224"): 1st = highest value, tied entries
 * share a rank and the next rank skips (two tied 5th → both 5th, next 7th).
 * rank(x) = 1 + |{ y : value(y) > value(x) }|, which gives that for free.
 */
export function rankStandardCompetition<T>(
  items: T[],
  getValue: (item: T) => number,
): Array<{ item: T; rank: number }> {
  // Round first: two grades that print identically (equal to 2dp) must tie, even
  // when their float paths drift at ~1e-14. Compare the rounded values, not raw.
  const values = items.map((item) => round2(getValue(item)));
  return items.map((item, i) => ({
    item,
    rank: 1 + values.filter((v) => v > values[i]).length,
  }));
}

/** Round to 2 decimal places — the precision grades are displayed at. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Arithmetic mean, or `null` for an empty list. Returning null (never NaN) keeps
 * a `sum/0` from silently escaping into a query result and breaking the chart —
 * callers translate an empty/floored class into an explicit "no data" signal.
 */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** The school's letter grades, worst-to-best kept explicit so a spread is total. */
export type LetterGrade = "A+" | "A" | "B" | "C" | "D" | "F";
const LETTER_GRADES: LetterGrade[] = ["A+", "A", "B", "C", "D", "F"];

/**
 * Count grades into the six letter buckets, zero-filling absent ones so the
 * distribution is always total (a bar chart needs every bucket, even empty).
 * Unrecognised letters are ignored rather than crashing the cohort view.
 */
export function gradeSpread(letters: string[]): Record<LetterGrade, number> {
  const spread = Object.fromEntries(LETTER_GRADES.map((g) => [g, 0])) as Record<
    LetterGrade,
    number
  >;
  for (const letter of letters) {
    if (letter in spread) spread[letter as LetterGrade] += 1;
  }
  return spread;
}
