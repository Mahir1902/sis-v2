import { dhakaDate } from "../../lib/attendanceDate";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * The one definition of "the current academic year".
 *
 * A year covers a day when the day's Dhaka-local label ("YYYY-MM-DD", the
 * same label `attendance.date` stores) falls inside the year's bounds, both
 * ends inclusive. The bounds are epoch ms and go through `dhakaDate()` — the
 * same conversion `attendance.semesterPeriod` uses — so a year that ends on
 * 31 May covers all of 31 May in Dhaka, and none of 1 June.
 *
 * Exactly one year covers today → that year. Otherwise there is no current
 * year, and the result says why:
 *  - `none`: today is in a gap between years, before the first, after the
 *    last, or no year exists;
 *  - `overlap`: two or more years cover today. Deployments seeded before
 *    this change have years running 1 June → 31 July of the next year, so
 *    neighbours share June–July until their dates are trimmed (new seeds and
 *    the promotions page's suggestion end on 31 May).
 * Never a fallback to "the latest" or "the first": a caller with no current
 * year leaves the year unselected and the user picks.
 */
export type CurrentAcademicYear =
  | { status: "current"; year: Doc<"academicYears"> }
  | { status: "none" }
  | { status: "overlap"; years: Doc<"academicYears">[] };

type Bounds = { startDate: number; endDate: number };

/** The year's first and last day as Dhaka-local labels. */
export function yearDays(year: Bounds): { first: string; last: string } {
  return { first: dhakaDate(year.startDate), last: dhakaDate(year.endDate) };
}

/** True when the two years share at least one Dhaka-local day. */
export function yearsOverlap(a: Bounds, b: Bounds): boolean {
  const x = yearDays(a);
  const y = yearDays(b);
  return x.first <= y.last && y.first <= x.last;
}

/** Pure: which of `years` is current on the Dhaka-local day `today`. */
export function resolveCurrentAcademicYear(
  years: Doc<"academicYears">[],
  today: string,
): CurrentAcademicYear {
  const covering = years.filter((y) => {
    const { first, last } = yearDays(y);
    return first <= today && today <= last;
  });
  if (covering.length === 1) return { status: "current", year: covering[0] };
  if (covering.length === 0) return { status: "none" };
  return {
    status: "overlap",
    years: covering.sort((a, b) => a.startDate - b.startDate),
  };
}

/**
 * The current academic year on `today` (default: the Dhaka-local day now).
 * No index: the table holds one row per school year.
 */
export async function getCurrentAcademicYear(
  ctx: QueryCtx | MutationCtx,
  today: string = dhakaDate(),
): Promise<CurrentAcademicYear> {
  const years = await ctx.db.query("academicYears").take(100);
  return resolveCurrentAcademicYear(years, today);
}
