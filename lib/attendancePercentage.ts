/**
 * The attendance figure (spec §2). The counting is server-side; the division
 * lives here so the screen and any future report-card generator share one
 * arithmetic (§7 A8).
 */

/**
 * Whole-number percentage, rounded DOWN. Returns null when the denominator
 * is zero — the caller renders "—", never 0%.
 */
export function attendancePercentage(c: {
  present: number;
  late: number;
  denominator: number;
}): number | null {
  if (c.denominator <= 0) return null;
  return Math.floor(((c.present + c.late) / c.denominator) * 100);
}
