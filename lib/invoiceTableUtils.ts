/**
 * Pure presentation helpers for the invoice list table.
 *
 * These functions are deliberately framework-free so they can be unit-tested
 * without a React or Convex context. The page component consumes them so the
 * JSX stays free of status-to-style switch statements.
 *
 * Status palette is co-located with `InvoiceDocument.tsx` — invoice statuses
 * use slightly different colours from the student statuses listed in CLAUDE.md:
 *   - draft   → neutral gray (work in progress, not yet sent)
 *   - sent    → blue        (awaiting payment, not yet late)
 *   - paid    → green       (closed)
 *   - overdue → red         (action required)
 *   - voided  → muted gray  (closed, ignored from aggregates)
 *
 * If a third caller needs the same palette, promote to `lib/invoiceStatus.ts`.
 */

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "voided";

/**
 * Tailwind utility class for a small colored dot rendered before the status
 * label in the data table. Returns the background color only — the caller is
 * expected to add `h-2 w-2 rounded-full` or similar sizing on the element.
 */
export function formatStatusDotClass(status: InvoiceStatus): string {
  switch (status) {
    case "draft":
      return "bg-gray-400";
    case "sent":
      return "bg-blue-500";
    case "paid":
      return "bg-green-500";
    case "overdue":
      return "bg-red-500";
    case "voided":
      return "bg-gray-400";
  }
}

/**
 * Tailwind utility class string for the invoice status pill / badge. Uses the
 * canonical `bg-<color>-400/40 text-<color>-700` shape from CLAUDE.md so the
 * pill blends with student status badges visually.
 */
export function formatStatusBadgeClass(status: InvoiceStatus): string {
  switch (status) {
    case "draft":
      return "bg-gray-400/40 text-gray-700";
    case "sent":
      return "bg-blue-400/40 text-blue-700";
    case "paid":
      return "bg-green-400/40 text-green-700";
    case "overdue":
      return "bg-red-400/40 text-red-700";
    case "voided":
      return "bg-gray-400/40 text-gray-600";
  }
}

/**
 * Human-readable label for an invoice status. Capitalises the first letter so
 * the raw enum value never leaks into the UI.
 */
export function formatStatusLabel(status: InvoiceStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Decides whether the due-date cell should render with a red highlight.
 *
 * Rule (matches the aggregate / cron logic in `lib/invoiceAggregates.ts`):
 *   - true if the invoice's stored status is `overdue`
 *   - OR if the invoice is `sent` AND its `dueDate` is strictly before `now`
 *     (the daily overdue cron has not yet flipped it).
 *
 * Returns false for every other status — drafts and paid invoices never show a
 * red due date even when their dueDate is in the past.
 */
export function shouldRenderDueDateRed(
  status: InvoiceStatus,
  dueDate: number,
  now: number,
): boolean {
  if (status === "overdue") return true;
  if (status === "sent" && dueDate < now) return true;
  return false;
}

/**
 * True iff the row-level "Void Invoice" action should be disabled. A paid
 * invoice cannot be voided (any reversal must go through the payment refund
 * flow), and an already-voided invoice obviously cannot be voided again.
 *
 * Matches the server-side guard in `convex/invoices.ts:voidInvoice` — keep in
 * sync if the backend rule ever changes.
 */
export function shouldDisableVoid(status: InvoiceStatus): boolean {
  return status === "paid" || status === "voided";
}
