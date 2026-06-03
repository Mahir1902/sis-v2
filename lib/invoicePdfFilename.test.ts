import { describe, expect, it } from "vitest";
import { buildInvoicePdfFilename } from "./invoicePdfFilename";

/**
 * Filename builder for the invoice PDF download. The shape is
 * `INV-{invoiceNumber}_{StudentName}.pdf`. The literal "INV-" prefix is applied
 * at most once — when the upstream invoiceNumber is already in the production
 * `INV-{YYYY}-{NNN}` format, the result is `INV-{YYYY}-{NNN}_{name}.pdf`
 * (not `INV-INV-…`).
 *
 * Sanitisation rules:
 *  - Strip Windows-illegal chars  <>:"|?*\/  AND control chars \x00-\x1F
 *  - Collapse runs of whitespace into a single space
 *  - Trim leading/trailing whitespace
 *  - Preserve Unicode (Bangla, Arabic, etc.)
 *  - Truncate the final filename to 200 chars max while keeping `.pdf`
 *  - Fall back to "invoice" for the student name if it sanitises to empty
 */

describe("buildInvoicePdfFilename", () => {
  it("returns {invoiceNumber}_{studentName}.pdf when invoiceNumber already starts with INV-", () => {
    // Production invoice numbers are formatted `INV-{YYYY}-{NNN}` upstream, so
    // the builder must not double the prefix.
    expect(
      buildInvoicePdfFilename({
        invoiceNumber: "INV-2025-001",
        studentName: "Aisha Rahman",
      }),
    ).toBe("INV-2025-001_Aisha Rahman.pdf");
  });

  it("prepends INV- when the invoiceNumber does not already start with it", () => {
    expect(
      buildInvoicePdfFilename({
        invoiceNumber: "2025-001",
        studentName: "Aisha Rahman",
      }),
    ).toBe("INV-2025-001_Aisha Rahman.pdf");
  });

  it("strips Windows-illegal characters from the student name", () => {
    expect(
      buildInvoicePdfFilename({
        invoiceNumber: "2025-042",
        studentName: 'Alice "Ali" Smith/Jones',
      }),
    ).toBe("INV-2025-042_Alice Ali SmithJones.pdf");
  });

  it("preserves Bangla unicode characters in the student name", () => {
    const result = buildInvoicePdfFilename({
      invoiceNumber: "2025-100",
      studentName: "মোহাম্মদ আব্দুল্লাহ",
    });
    expect(result).toContain("মোহাম্মদ আব্দুল্লাহ");
    expect(result.endsWith(".pdf")).toBe(true);
    expect(result.startsWith("INV-2025-100_")).toBe(true);
  });

  it("strips ASCII control characters (\\x00–\\x1F) from the student name", () => {
    expect(
      buildInvoicePdfFilename({
        invoiceNumber: "2025-007",
        studentName: "A\x00\x1Fname",
      }),
    ).toBe("INV-2025-007_Aname.pdf");
  });

  it("collapses internal whitespace runs to a single space", () => {
    expect(
      buildInvoicePdfFilename({
        invoiceNumber: "2025-008",
        studentName: "Foo    Bar",
      }),
    ).toBe("INV-2025-008_Foo Bar.pdf");
  });

  it("trims leading and trailing whitespace from the student name", () => {
    expect(
      buildInvoicePdfFilename({
        invoiceNumber: "2025-009",
        studentName: "   Trimmed Name   ",
      }),
    ).toBe("INV-2025-009_Trimmed Name.pdf");
  });

  it("truncates the final filename to 200 characters while keeping the .pdf extension", () => {
    const veryLongName = "x".repeat(500);
    const result = buildInvoicePdfFilename({
      invoiceNumber: "2025-010",
      studentName: veryLongName,
    });
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith(".pdf")).toBe(true);
    expect(result.startsWith("INV-2025-010_")).toBe(true);
  });

  it("falls back to 'invoice' when the student name sanitises to empty", () => {
    // All-illegal name should fall back to a defensible default.
    expect(
      buildInvoicePdfFilename({
        invoiceNumber: "2025-011",
        studentName: '<>:"|?*/\\',
      }),
    ).toBe("INV-2025-011_invoice.pdf");
  });

  it("falls back to 'invoice' when the student name is the empty string", () => {
    expect(
      buildInvoicePdfFilename({
        invoiceNumber: "2025-012",
        studentName: "",
      }),
    ).toBe("INV-2025-012_invoice.pdf");
  });
});
