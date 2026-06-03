import { describe, expect, it } from "vitest";
import { BULK_PDF_MAX_COUNT, buildZipFilename } from "./invoiceBulkPdf";

/**
 * Zip-file naming for bulk invoice PDF downloads. UTC zero-padded.
 * Format: `invoices-YYYYMMDD-HHmm.zip`.
 *
 * UTC (not local time) is intentional: the admin team coordinates across
 * timezones, so naming collisions and "which version is newer" disputes are
 * resolved by always anchoring on UTC.
 */

describe("buildZipFilename", () => {
  it("returns invoices-YYYYMMDD-HHmm.zip in UTC for a midday timestamp", () => {
    // 2026-06-01T14:37:00Z
    const ts = Date.UTC(2026, 5, 1, 14, 37, 0);
    expect(buildZipFilename(ts)).toBe("invoices-20260601-1437.zip");
  });

  it("zero-pads single-digit month, day, hour, and minute components", () => {
    // 2026-01-09T03:05:00Z — every component is single-digit.
    const ts = Date.UTC(2026, 0, 9, 3, 5, 0);
    expect(buildZipFilename(ts)).toBe("invoices-20260109-0305.zip");
  });

  it("uses UTC at the midnight boundary (00:00 UTC)", () => {
    // 2027-12-31T00:00:00Z — anchor on the UTC midnight, not local.
    const ts = Date.UTC(2027, 11, 31, 0, 0, 0);
    expect(buildZipFilename(ts)).toBe("invoices-20271231-0000.zip");
  });

  it("uses UTC at one minute before midnight UTC", () => {
    // 2026-06-15T23:59:00Z
    const ts = Date.UTC(2026, 5, 15, 23, 59, 0);
    expect(buildZipFilename(ts)).toBe("invoices-20260615-2359.zip");
  });
});

describe("BULK_PDF_MAX_COUNT", () => {
  it("caps bulk downloads at 25 invoices per Devil's Advocate decision #6", () => {
    expect(BULK_PDF_MAX_COUNT).toBe(25);
  });
});
