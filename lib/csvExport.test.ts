import { describe, expect, it } from "vitest";
import {
  buildTransactionCSVRows,
  CSV_EXPORT_HEADERS,
  type CSVLineItemRow,
  escapeCSVField,
  generateCSVContent,
  generateTransactionFilename,
} from "./csvExport";

describe("escapeCSVField", () => {
  it("passes through plain strings unchanged", () => {
    expect(escapeCSVField("hello")).toBe("hello");
  });

  it("quotes strings containing commas", () => {
    expect(escapeCSVField("hello, world")).toBe('"hello, world"');
  });

  it("escapes double quotes by doubling them and quoting", () => {
    expect(escapeCSVField('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes strings containing newlines", () => {
    expect(escapeCSVField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("returns empty string unchanged", () => {
    expect(escapeCSVField("")).toBe("");
  });

  it("handles strings with both commas and quotes", () => {
    expect(escapeCSVField('"name", value')).toBe('"""name"", value"');
  });
});

describe("generateCSVContent", () => {
  it("produces header-only CSV when rows are empty", () => {
    const result = generateCSVContent(["A", "B", "C"], []);
    expect(result).toBe("A,B,C");
  });

  it("produces correct CSV with headers and rows", () => {
    const result = generateCSVContent(
      ["Name", "Amount"],
      [
        ["Alice", "1000"],
        ["Bob", "2000"],
      ],
    );
    expect(result).toBe("Name,Amount\nAlice,1000\nBob,2000");
  });

  it("escapes special characters in data", () => {
    const result = generateCSVContent(["Name"], [["Smith, John"]]);
    expect(result).toBe('Name\n"Smith, John"');
  });
});

function makeLineItem(overrides: Partial<CSVLineItemRow> = {}): CSVLineItemRow {
  return {
    transactionDate: new Date("2025-01-15T00:00:00Z").getTime(),
    invoiceNumber: "INV-001",
    studentName: "Alice Smith",
    studentNumber: "STU-001",
    campus: "Main",
    feeName: "Monthly Tuition",
    billingPeriod: "2025-01",
    amount: 5000,
    paymentMode: "Cash",
    status: "completed",
    collectedByName: "Admin User",
    ...overrides,
  };
}

describe("buildTransactionCSVRows", () => {
  it("maps line-item fields to correct column order", () => {
    const rows = buildTransactionCSVRows([makeLineItem()]);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row[0]).toMatch(/2025-01-15/); // Date
    expect(row[1]).toBe("INV-001"); // Invoice #
    expect(row[2]).toBe("Alice Smith"); // Student Name
    expect(row[3]).toBe("STU-001"); // Admission #
    expect(row[4]).toBe("Main"); // Campus
    expect(row[5]).toBe("Monthly Tuition"); // Fee Name
    expect(row[6]).toBe("Jan 2025"); // Billing Period (formatted)
    expect(row[7]).toBe("5000"); // Amount
    expect(row[8]).toBe("Cash"); // Payment Mode
    expect(row[9]).toBe("completed"); // Status
    expect(row[10]).toBe("Admin User"); // Collected By
  });

  it("handles null campus as empty string", () => {
    const rows = buildTransactionCSVRows([makeLineItem({ campus: null })]);
    expect(rows[0][4]).toBe("");
  });

  it("handles null billing period as empty string", () => {
    const rows = buildTransactionCSVRows([
      makeLineItem({ billingPeriod: null }),
    ]);
    expect(rows[0][6]).toBe("");
  });

  it("formats billing period correctly", () => {
    const rows = buildTransactionCSVRows([
      makeLineItem({ billingPeriod: "2025-12" }),
    ]);
    expect(rows[0][6]).toBe("Dec 2025");
  });

  it("returns empty array for empty input", () => {
    expect(buildTransactionCSVRows([])).toEqual([]);
  });

  it("produces multiple rows from a multi-item session", () => {
    const rows = buildTransactionCSVRows([
      makeLineItem({
        invoiceNumber: "INV-100",
        feeName: "Sports Fee",
        billingPeriod: "2025-01",
        amount: 1000,
      }),
      makeLineItem({
        invoiceNumber: "INV-100",
        feeName: "Sports Fee",
        billingPeriod: "2025-02",
        amount: 1000,
      }),
      makeLineItem({
        invoiceNumber: "INV-100",
        feeName: "Sports Fee",
        billingPeriod: "2025-03",
        amount: 1000,
      }),
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0][1]).toBe("INV-100");
    expect(rows[1][1]).toBe("INV-100");
    expect(rows[2][1]).toBe("INV-100");
    expect(rows[0][6]).toBe("Jan 2025");
    expect(rows[1][6]).toBe("Feb 2025");
    expect(rows[2][6]).toBe("Mar 2025");
  });

  it("column count matches header count", () => {
    const rows = buildTransactionCSVRows([makeLineItem()]);
    expect(rows[0]).toHaveLength(CSV_EXPORT_HEADERS.length);
  });
});

describe("generateTransactionFilename", () => {
  it("produces filename with year only when no level or date range", () => {
    const filename = generateTransactionFilename("2024-2025");
    expect(filename).toMatch(/^transactions-All-2024-2025\.csv$/);
  });

  it("includes level name when provided", () => {
    const filename = generateTransactionFilename("2024-2025", "Grade 6");
    expect(filename).toBe("transactions-Grade-6-2024-2025.csv");
  });

  it("includes date range label when provided", () => {
    const filename = generateTransactionFilename(
      "2024-2025",
      undefined,
      "Jan-2026",
    );
    expect(filename).toBe("transactions-All-Jan-2026-2024-2025.csv");
  });

  it("includes both level and date range", () => {
    const filename = generateTransactionFilename(
      "2024-2025",
      "Grade 3",
      "Q2-2026",
    );
    expect(filename).toBe("transactions-Grade-3-Q2-2026-2024-2025.csv");
  });

  it("sanitizes spaces in level name to hyphens", () => {
    const filename = generateTransactionFilename("2025-2026", "KG 1");
    expect(filename).toBe("transactions-KG-1-2025-2026.csv");
  });
});
