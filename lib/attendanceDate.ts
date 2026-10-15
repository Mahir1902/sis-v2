/**
 * Dhaka-local calendar-day helpers for attendance (spec §1.2–1.3).
 *
 * Attendance dates are the text label "YYYY-MM-DD" for the Dhaka-local day —
 * a school day is a label, not a moment. Bangladesh has been UTC+6 with no
 * DST since 2009, so the offset is a constant (same idiom as
 * `lib/receiptNumber.ts`). Shared by Convex functions and the client.
 *
 * The trap this avoids: `new Date().toISOString().slice(0, 10)` is the
 * PREVIOUS day after 18:00 Dhaka, and `setHours(0,0,0,0)` lands on 18:00 UTC
 * of the day before.
 */

export const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Teacher correction window in calendar days (#116). One constant, one file. */
export const EDIT_WINDOW_DAYS = 14;

/** The Dhaka-local calendar day ("YYYY-MM-DD") at the given UTC ms. */
export function dhakaDate(ms: number = Date.now()): string {
  return new Date(ms + BD_OFFSET_MS).toISOString().slice(0, 10);
}

/** Shift a "YYYY-MM-DD" label by whole calendar days (negative = back). */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True for a real calendar day written as "YYYY-MM-DD" ("2026-02-30" is not). */
export function isDateLabel(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** Friday or Saturday — the school's weekly off days, a constant in code. */
export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 5 || day === 6;
}

/** "YYYY-MM-DD" → "DD-MM-YYYY" for display. */
export function formatDisplayDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
}
