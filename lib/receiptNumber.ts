/**
 * Receipt-number helpers (ADR-0002).
 *
 * Receipt numbers are calendar-year scoped — the sequence resets to 1 on
 * January 1st in Asia/Dhaka, the school's operating timezone. We compute the
 * "current BD year" from the offset directly rather than via the host
 * timezone so the helper is deterministic on every machine that runs Convex,
 * regardless of where the function executes.
 *
 * Bangladesh has been on UTC+6 with no DST since the 2009 trial was abandoned,
 * so the offset is a constant — no Intl/timezone-database lookup required.
 */

const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

/**
 * Returns the calendar year as observed in Asia/Dhaka at the given UTC ms
 * timestamp (defaults to `Date.now()`).
 *
 * Edge case the AC calls out: at 23:55 BD on Dec 31, UTC is still 17:55 of
 * the same day, so this returns the current year. At 00:05 BD on Jan 1, UTC
 * is 18:05 of Dec 31, but BD is the new year — this returns next year.
 */
export function currentBdYear(nowMs: number = Date.now()): number {
  return new Date(nowMs + BD_OFFSET_MS).getUTCFullYear();
}

/**
 * Formats a year + sequence into the parent-facing receipt number.
 *
 * The sequence is zero-padded to five digits — the school does not expect
 * to issue more than 99,999 receipts in a single year. If it ever does, the
 * caller will see a thrown error long before silent truncation can happen.
 *
 * @example
 *   formatReceiptNumber(2026, 1)     // "RCP-2026-00001"
 *   formatReceiptNumber(2026, 42)    // "RCP-2026-00042"
 *   formatReceiptNumber(2026, 99999) // "RCP-2026-99999"
 */
export function formatReceiptNumber(year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99999) {
    throw new Error(
      `Receipt sequence must be an integer in [1, 99999]; got ${sequence}`,
    );
  }
  return `RCP-${year}-${String(sequence).padStart(5, "0")}`;
}
