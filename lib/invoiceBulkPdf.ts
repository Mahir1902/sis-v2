/**
 * Helpers for bulk invoice PDF downloads (Issue #28).
 *
 * Kept tiny and pure so they can be unit-tested without dragging the
 * `@react-pdf/renderer` or `jszip` modules into the test environment. The
 * actual zip generation lives in `hooks/use-invoice-pdf-download.ts`, which
 * dynamic-imports the heavy deps to keep them out of the route bundle.
 */

/**
 * Maximum number of invoices a single bulk download may include.
 *
 * Reason: @react-pdf renders on the main thread; 25 invoices on a modern
 * laptop completes in well under a minute, while 100+ risks OOMing the tab.
 * Devil's Advocate decision #6 — do not raise this without a perf test.
 */
export const BULK_PDF_MAX_COUNT = 25;

/**
 * Returns the zip filename for a bulk PDF download, anchored on UTC.
 *
 * Format: `invoices-YYYYMMDD-HHmm.zip` with every component zero-padded.
 * UTC (not local) is intentional — admins coordinate across timezones, so
 * filenames are deterministic regardless of the downloader's locale.
 */
export function buildZipFilename(now: number): string {
  const d = new Date(now);
  const year = d.getUTCFullYear();
  const month = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const hours = pad2(d.getUTCHours());
  const minutes = pad2(d.getUTCMinutes());
  return `invoices-${year}${month}${day}-${hours}${minutes}.zip`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
