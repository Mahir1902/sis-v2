import { format } from "date-fns";

/**
 * Escapes a string for safe inclusion in a CSV field.
 * If the field contains commas, double quotes, or newlines, it is
 * wrapped in double quotes, and any internal double quotes are doubled.
 */
export function escapeCSVField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Generates a complete CSV string from headers and rows.
 * Each row is an array of string values. All values are escaped.
 */
export function generateCSVContent(
  headers: string[],
  rows: string[][],
): string {
  const headerLine = headers.map(escapeCSVField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSVField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

/** Shape of a line-item row for CSV export. */
export type CSVLineItemRow = {
  transactionDate: number;
  invoiceNumber: string;
  studentName: string;
  studentNumber: string;
  campus: string | null;
  feeName: string;
  billingPeriod: string | null;
  amount: number;
  paymentMode: string;
  status: string;
  collectedByName: string;
};

export const CSV_EXPORT_HEADERS = [
  "Date",
  "Invoice #",
  "Student Name",
  "Admission #",
  "Campus",
  "Fee Name",
  "Billing Period",
  "Amount",
  "Payment Mode",
  "Status",
  "Collected By",
] as const;

/**
 * Formats a billing period string (e.g. "2025-01") into a readable
 * month-year label (e.g. "Jan 2025"). Returns empty string for null input.
 */
function formatBillingPeriod(period: string | null): string {
  if (!period) return "";
  const [year, month] = period.split("-");
  if (!year || !month) return period;
  const date = new Date(Number(year), Number(month) - 1);
  return format(date, "MMM yyyy");
}

/**
 * Converts line-item rows into string arrays matching the CSV column order:
 * Date, Invoice #, Student Name, Admission #, Campus, Fee Name, Billing Period, Amount, Payment Mode, Status, Collected By
 */
export function buildTransactionCSVRows(
  lineItems: CSVLineItemRow[],
): string[][] {
  return lineItems.map((item) => [
    format(new Date(item.transactionDate), "yyyy-MM-dd"),
    item.invoiceNumber,
    item.studentName,
    item.studentNumber,
    item.campus ?? "",
    item.feeName,
    formatBillingPeriod(item.billingPeriod),
    String(item.amount),
    item.paymentMode,
    item.status,
    item.collectedByName,
  ]);
}

/**
 * Generates a download filename for the CSV export.
 * Format: transactions-{level}-{dateRange}-{yearName}.csv
 * - With level: transactions-Grade-6-2024-2025.csv
 * - Without level: transactions-All-2024-2025.csv
 * - With both: transactions-Grade-3-Q2-2026-2024-2025.csv
 * Spaces in level name become hyphens.
 */
export function generateTransactionFilename(
  yearName: string,
  levelName?: string,
  dateRangeLabel?: string,
): string {
  const level = levelName ? levelName.replace(/\s+/g, "-") : "All";
  const parts = ["transactions", level];
  if (dateRangeLabel) parts.push(dateRangeLabel);
  parts.push(yearName);
  return `${parts.join("-")}.csv`;
}

/**
 * Triggers a browser download of the given CSV content.
 * Creates a Blob, generates an object URL, clicks a temporary anchor, then cleans up.
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
