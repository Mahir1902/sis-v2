/**
 * Pure display helpers for the invoice document view.
 *
 * Extracted from `components/shared/InvoiceDocument.tsx` so the component
 * stays presentational and these tiny conditional class rules can be
 * unit-tested in isolation (CLAUDE.md frontend rule #9 — no business logic in
 * component bodies). The helpers intentionally return Tailwind utility class
 * strings rather than booleans so the call site is a one-liner.
 */

/**
 * Status of an invoice as stored in the `invoices` table. Mirrored here so
 * components and hooks can share a single source of truth without reaching
 * into Convex schema types at the type-system level.
 */
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "voided";

/**
 * Tailwind class for the "Balance Due" amount.
 *
 * Strict `> 0` semantics: any non-positive balance (including a zero balance
 * and the overpayment edge case where balance < 0) is rendered in the green
 * "cleared" tone. Only an actual outstanding amount turns red. This matches
 * the inline ternary that used to live in the component.
 */
export function balanceClassFor(balance: number): string {
  return balance > 0 ? "text-red-600" : "text-green-700";
}

/**
 * Tailwind class for the "Due Date" label.
 *
 * Red emphasis is reserved for invoices whose stored status is `overdue` —
 * the daily cron flips `sent` invoices to `overdue` once their due date has
 * passed, so we trust the stored status rather than re-computing here.
 */
export function dueDateClassFor(status: InvoiceStatus): string {
  return status === "overdue" ? "text-red-600 font-medium" : "font-medium";
}
