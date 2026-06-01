/**
 * Pure utilities for the invoicing feature.
 *
 * These functions are deliberately framework-free so they can be unit-tested
 * without a Convex context. The Convex mutations in `convex/invoices.ts`
 * compose these primitives with database reads/writes.
 *
 * Invoice number format: `INV-YYYY-NNN`
 *   - YYYY is the first 4 chars of the academic year label (e.g. "2024-2025" → "2024")
 *   - NNN is a 1-based sequence within that year, left-padded to a minimum of 3 digits.
 *     Sequences greater than 999 keep their natural width — they are NOT truncated.
 */

/** Internal: zero-pad a positive integer to at least `width` digits. */
function padSequence(seq: number, width: number): string {
  const s = String(seq);
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

/** Internal: returns true iff `s` is a non-empty string of decimal digits. */
function isAllDigits(s: string): boolean {
  return s.length > 0 && /^[0-9]+$/.test(s);
}

/**
 * Builds an invoice number from an academic year label and a 1-based sequence.
 *
 * @param academicYearLabel The full year label, e.g. "2024-2025" or "2024".
 *   The first 4 characters MUST be digits; they form the YYYY segment.
 * @param sequence A positive integer (>= 1). Padded to 3 digits; values above
 *   999 keep their natural width (e.g. 1000 → "1000").
 * @returns A string of the form `INV-YYYY-NNN`.
 * @throws If the year prefix is not 4 digits or the sequence is not a positive integer.
 */
export function formatInvoiceNumber(
  academicYearLabel: string,
  sequence: number,
): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Invoice sequence must be a positive integer");
  }
  const yearPrefix = academicYearLabel.slice(0, 4);
  if (!isAllDigits(yearPrefix) || yearPrefix.length !== 4) {
    throw new Error("Academic year label must start with 4 digits");
  }
  return `INV-${yearPrefix}-${padSequence(sequence, 3)}`;
}

/**
 * Inverse of `formatInvoiceNumber`. Returns the year and sequence if the
 * input matches the canonical shape, or `null` if it is malformed.
 *
 * Tolerates sequences of any length (>= 1 digit) so values above 999 round-trip.
 */
export function parseInvoiceNumber(
  invoiceNumber: string,
): { year: string; sequence: number } | null {
  if (typeof invoiceNumber !== "string" || invoiceNumber.length === 0) {
    return null;
  }
  const parts = invoiceNumber.split("-");
  if (parts.length !== 3) return null;
  const [prefix, year, seqStr] = parts;
  if (prefix !== "INV") return null;
  if (year.length !== 4 || !isAllDigits(year)) return null;
  if (!isAllDigits(seqStr)) return null;
  const sequence = Number.parseInt(seqStr, 10);
  if (!Number.isFinite(sequence) || sequence < 1) return null;
  return { year, sequence };
}

/**
 * Sums line-item amounts and computes the outstanding balance after a paid amount.
 *
 * - `totalAmount` is rounded to 2 decimal places (financial rounding).
 * - `balance = max(0, totalAmount - paidAmount)` — never negative.
 *
 * Both values are returned rounded to 2dp so callers can store them directly.
 */
export function computeInvoiceTotals(
  lineItems: ReadonlyArray<{ amount: number }>,
  paidAmount: number,
): { totalAmount: number; balance: number } {
  const rawTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const totalAmount = Math.round(rawTotal * 100) / 100;
  const safePaid = Number.isFinite(paidAmount) ? Math.max(0, paidAmount) : 0;
  const rawBalance = totalAmount - safePaid;
  const balance = Math.max(0, Math.round(rawBalance * 100) / 100);
  return { totalAmount, balance };
}

/**
 * Given a flat list of existing invoice numbers and a target 4-digit year,
 * returns the next sequence to use (max+1 of matching entries, or 1 if none).
 *
 * Invoice numbers from other years and malformed entries are silently ignored.
 *
 * @param existingNumbers The full list of invoice numbers to consider.
 * @param yearLabel The target year prefix (first 4 chars used).
 */
export function nextInvoiceSequence(
  existingNumbers: ReadonlyArray<string>,
  yearLabel: string,
): number {
  const targetYear = yearLabel.slice(0, 4);
  if (targetYear.length !== 4 || !isAllDigits(targetYear)) {
    // Defensive: an invalid year prefix means there can be no valid matches.
    // Returning 1 lets callers still recover, but the format step downstream
    // would throw with a clearer error.
    return 1;
  }
  let maxSeq = 0;
  for (const num of existingNumbers) {
    const parsed = parseInvoiceNumber(num);
    if (!parsed) continue;
    if (parsed.year !== targetYear) continue;
    if (parsed.sequence > maxSeq) maxSeq = parsed.sequence;
  }
  return maxSeq + 1;
}
