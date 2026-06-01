/**
 * Date formatting helpers shared across the app.
 *
 * The school issues invoices and receipts in DD/MM/YYYY format. This file
 * centralises the formatter so changing locale or padding rules is a one-line
 * edit, not a project-wide find-and-replace.
 */

/**
 * Formats a Unix ms timestamp as `DD/MM/YYYY` with zero-padded day and month.
 *
 * Uses the host's local timezone (matching how the rest of the app interprets
 * `Date.now()` values it stores). Returns "—" for non-finite or non-positive
 * inputs so the UI does not render `NaN/NaN/NaN`.
 *
 * @example
 * fmtDayMonthYear(new Date("2025-05-08").getTime()) // "08/05/2025"
 * fmtDayMonthYear(0)                                // "—"
 */
export function fmtDayMonthYear(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";

  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}
