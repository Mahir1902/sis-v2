import { format } from "date-fns";

/**
 * Formats an amount as BDT currency with the ৳ symbol.
 * Uses Indian numbering system (lakh/crore grouping).
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "BDT",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a Unix ms timestamp to a human-readable date string.
 * Example: "Jan 15, 2025"
 */
export function formatTransactionDate(timestamp: number): string {
  return format(new Date(timestamp), "MMM d, yyyy");
}

/**
 * Returns Tailwind badge classes for a transaction session status.
 */
export function getStatusBadgeStyle(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-400/40 text-green-700";
    case "voided":
      return "bg-red-400/40 text-red-700";
    default:
      return "bg-gray-400/40 text-gray-700";
  }
}

// ── Line item formatting ────────────────────────────────────────────────────

/** Formats a single fee transaction line item for display in the detail sheet. */
export function formatLineItem(txn: {
  amount: number;
  feeStructureName?: string;
  billingPeriod?: string;
}): { label: string; amount: string; period: string } {
  return {
    label: txn.feeStructureName ?? "—",
    amount: formatCurrency(txn.amount),
    period: txn.billingPeriod
      ? format(new Date(`${txn.billingPeriod}-01`), "MMM yyyy")
      : "—",
  };
}
