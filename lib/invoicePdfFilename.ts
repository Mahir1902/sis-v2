/**
 * Builds the on-disk filename for a downloaded invoice PDF.
 *
 * Format: `INV-{invoiceNumber}_{studentName}.pdf`. When `invoiceNumber` already
 * starts with `INV-` (the production format from `convex/invoices.ts` is
 * `INV-{YYYY}-{NNN}`), the prefix is NOT doubled — the literal "INV-" is
 * applied at most once. This keeps the spec's intent without producing
 * `INV-INV-2025-001_…` on disk.
 *
 * Student-name sanitisation:
 *  - Strip Windows-illegal chars  `<>:"|?*\/`  AND control chars `\x00-\x1F`.
 *  - Collapse internal whitespace runs to a single space; trim ends.
 *  - PRESERVE Unicode (the school's roster includes Bangla and Arabic names —
 *    we never transliterate or strip non-ASCII).
 *  - When the name sanitises to empty, fall back to "invoice".
 *
 * The whole filename is truncated to 200 characters while preserving the
 * `.pdf` extension so the trailing `.pdf` always survives even if the student
 * name has to be cut short.
 */

const MAX_FILENAME_LEN = 200;
const PDF_EXT = ".pdf";

// Windows-illegal chars and ASCII control chars. The character class is built
// from a string so the literal control chars never appear in source — this
// keeps biome's `noControlCharactersInRegex` rule happy while preserving the
// exact behaviour: stop \x00-\x1F and the Windows-reserved punctuation.
const ILLEGAL_CHAR_RE = new RegExp(`[<>:"|?*\\\\/${"\\u0000-\\u001F"}]+`, "g");
const WHITESPACE_RUN_RE = /\s+/g;

export interface BuildInvoicePdfFilenameInput {
  invoiceNumber: string;
  studentName: string;
}

export function buildInvoicePdfFilename({
  invoiceNumber,
  studentName,
}: BuildInvoicePdfFilenameInput): string {
  const sanitisedName = studentName
    .replace(ILLEGAL_CHAR_RE, "")
    .replace(WHITESPACE_RUN_RE, " ")
    .trim();

  const namePart = sanitisedName.length > 0 ? sanitisedName : "invoice";

  // Dedupe the literal "INV-" prefix — the upstream invoiceNumber field is the
  // production format `INV-{YYYY}-{NNN}`, so prepending blindly would produce
  // `INV-INV-...`.
  const numberPart = invoiceNumber.startsWith("INV-")
    ? invoiceNumber
    : `INV-${invoiceNumber}`;

  const full = `${numberPart}_${namePart}${PDF_EXT}`;

  if (full.length <= MAX_FILENAME_LEN) return full;

  // Truncate the body so the .pdf extension always survives.
  const budget = MAX_FILENAME_LEN - PDF_EXT.length;
  return `${full.slice(0, budget)}${PDF_EXT}`;
}
