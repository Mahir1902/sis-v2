"use client";

import { AlertCircle, Download, Loader2, Printer, Send, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Id } from "@/convex/_generated/dataModel";
import { useInvoiceDocument } from "@/hooks/use-invoice-document";
import { useInvoicePdfDownload } from "@/hooks/use-invoice-pdf-download";
import { formatCurrency } from "@/lib/currency";
import { fmtDayMonthYear } from "@/lib/dateFormat";
import type { InvoiceStatus } from "@/lib/invoiceDocumentDisplay";
import { SCHOOL_NAME } from "@/lib/schoolBrand";
import { cn } from "@/lib/utils";

/**
 * Tailwind utility class string for the invoice status pill. Co-located with
 * the component because invoice status colours are subtly different from the
 * student status palette (CLAUDE.md status-badge section). If a third caller
 * needs them, promote to `lib/invoiceStatus.ts`.
 *
 * - draft   → neutral gray (work in progress)
 * - issued  → blue (awaiting payment, not yet late)
 * - paid    → green (closed)
 * - overdue → red (action required)
 * - voided  → dim, struck-through visual upstream (color still gray)
 */
function statusBadgeClass(status: InvoiceStatus): string {
  switch (status) {
    case "draft":
      return "bg-gray-400/40 text-gray-700";
    case "issued":
      return "bg-blue-400/40 text-blue-700";
    case "paid":
      return "bg-green-400/40 text-green-700";
    case "overdue":
      return "bg-red-400/40 text-red-700";
    case "voided":
      return "bg-gray-400/40 text-gray-600";
  }
}

function statusLabel(status: InvoiceStatus): string {
  // Capitalise first letter — kept here so we never display the raw enum value.
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export interface InvoiceDocumentProps {
  invoiceId: Id<"invoices">;
  onClose?: () => void;
  /**
   * Render-prop slots for the toolbar action buttons.
   * When undefined, the corresponding button renders disabled so the layout
   * stays consistent for callers (e.g. the side-sheet preview) that have not
   * yet wired the action.
   */
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  onSend?: () => void;
}

/**
 * Renders the formatted invoice document for a single invoice id.
 *
 * Data is fetched via `api.invoices.getInvoiceById` (admin-only). Handles
 * loading skeleton, "not found" error state, and the happy path. Visually
 * modelled on the prototype, but uses production data and project tokens.
 *
 * The PDF toolbar button has a built-in default: if `onDownloadPdf` is not
 * supplied, the component calls `useInvoicePdfDownload().downloadSingle`
 * with its own `invoiceId`. This means side-sheet callers (e.g. issue #29)
 * get PDF download for free without re-wiring the prop. The hook is invoked
 * unconditionally to satisfy React's rules of hooks even when the prop is
 * supplied (the hook itself is cheap; the heavy modules are dynamic-imported
 * only when the click fires).
 */
export function InvoiceDocument({
  invoiceId,
  onClose,
  onPrint,
  onDownloadPdf,
  onSend,
}: InvoiceDocumentProps) {
  const result = useInvoiceDocument(invoiceId);
  const pdf = useInvoicePdfDownload();

  // Default the PDF handler to the hook's downloadSingle so consumers that
  // don't supply onDownloadPdf still get a working button.
  const effectiveDownloadPdf =
    onDownloadPdf ?? (() => void pdf.downloadSingle(invoiceId));

  if (result.state === "loading") {
    return <InvoiceDocumentLoading onClose={onClose} />;
  }

  if (result.state === "not-found") {
    return <InvoiceDocumentNotFound onClose={onClose} />;
  }

  const { invoice, status, balanceClass, dueDateClass } = result;
  const balance = invoice.balance;

  return (
    <div
      className="flex h-full flex-col"
      data-testid="invoice-document"
      data-invoice-status={status}
    >
      <Toolbar
        onClose={onClose}
        onPrint={onPrint}
        onDownloadPdf={effectiveDownloadPdf}
        isGeneratingPdf={pdf.isGenerating}
        onSend={onSend}
      />

      {/* Document body */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-2xl rounded-xl border bg-white p-6 shadow-sm md:p-10">
          {/* Header */}
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-3">
              <Image
                src="/SIS_Logo.svg"
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
                priority
              />
              <div>
                <p className="text-sm font-bold text-gray-900">{SCHOOL_NAME}</p>
                {invoice.campusAddress && (
                  <p className="text-xs text-muted-foreground">
                    {invoice.campusAddress}
                  </p>
                )}
              </div>
            </div>
            <div className="text-left md:text-right">
              <p className="text-2xl font-bold tracking-tight text-gray-900">
                INVOICE
              </p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {invoice.invoiceNumber}
              </p>
              <div className="mt-1">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    statusBadgeClass(status),
                  )}
                >
                  {statusLabel(status)}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Bill to + dates */}
          <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Bill To
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {invoice.studentName}
              </p>
              <p className="text-muted-foreground">
                {invoice.studentNumber} · {invoice.standardLevelName}
              </p>
              <p className="text-muted-foreground">{invoice.campusName}</p>
              <p className="text-muted-foreground">
                {invoice.academicYearName}
              </p>
            </div>
            <div className="space-y-1 text-left md:text-right">
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">Issue Date</span>
                <span className="font-medium">
                  {fmtDayMonthYear(invoice.issueDate)}
                </span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">Due Date</span>
                <span
                  className={dueDateClass}
                  data-testid="invoice-due-date"
                  data-overdue={status === "overdue"}
                >
                  {fmtDayMonthYear(invoice.dueDate)}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Line items */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="pb-2 text-left">Description</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <tr key={item.studentFeeId} className="border-t">
                  <td className="py-3 text-gray-700">{item.description}</td>
                  <td className="py-3 text-right font-medium">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Separator className="my-4" />

          {/* Totals */}
          <div className="ml-auto w-full space-y-2 text-sm sm:w-64">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(invoice.totalAmount)}</span>
            </div>
            {invoice.paidAmount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Paid</span>
                <span>– {formatCurrency(invoice.paidAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Balance Due</span>
              <span className={balanceClass} data-testid="invoice-balance">
                {formatCurrency(balance)}
              </span>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 rounded-md bg-gray-50 p-4 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Notes
              </p>
              <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Thank you for your prompt payment.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Toolbar ─────────────────────────────────────────────────────────────────

interface ToolbarProps {
  onClose?: () => void;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  /** When true, the PDF button shows a spinner and disables to prevent double-click. */
  isGeneratingPdf?: boolean;
  onSend?: () => void;
}

/**
 * Toolbar layout: close button on the LEFT (when provided), action buttons on
 * the RIGHT. Issue #29 depends on this layout — do not move the close button.
 *
 * Action buttons render disabled when their handler prop is undefined, so the
 * layout remains consistent in the side-sheet preview before wiring is done in
 * later issues.
 */
function Toolbar({
  onClose,
  onPrint,
  onDownloadPdf,
  isGeneratingPdf,
  onSend,
}: ToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close invoice"
            data-testid="invoice-close-button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <span className="text-sm font-medium text-muted-foreground">
          Preview
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={onPrint}
          disabled={!onPrint}
          aria-label="Print invoice"
          data-testid="invoice-print-button"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Print
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={onDownloadPdf}
          disabled={!onDownloadPdf || isGeneratingPdf}
          aria-label="Download invoice as PDF"
          data-testid="invoice-pdf-button"
        >
          {isGeneratingPdf ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          )}{" "}
          PDF
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-school-green text-xs text-white hover:bg-school-green/90"
          onClick={onSend}
          disabled={!onSend}
          aria-label="Send invoice to parent"
          data-testid="invoice-send-button"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" /> Send to Parent
        </Button>
      </div>
    </div>
  );
}

// ── Loading state ───────────────────────────────────────────────────────────

function InvoiceDocumentLoading({ onClose }: { onClose?: () => void }) {
  return (
    <div
      className="flex h-full flex-col"
      data-testid="invoice-document-loading"
      aria-busy="true"
      aria-live="polite"
    >
      <Toolbar onClose={onClose} />

      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-2xl rounded-xl border bg-white p-6 shadow-sm md:p-10">
          {/* Header skeleton */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-52" />
              </div>
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-6 w-24" />
              <Skeleton className="ml-auto h-3 w-28" />
              <Skeleton className="ml-auto h-5 w-16 rounded-full" />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Bill-to skeleton */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="space-y-2 md:text-right">
              <Skeleton className="ml-auto h-3 w-40" />
              <Skeleton className="ml-auto h-3 w-40" />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Line-items skeleton */}
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between border-t pt-3 first:border-t-0 first:pt-0"
              >
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Totals skeleton */}
          <div className="ml-auto w-full space-y-2 sm:w-64">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Separator />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Error state ─────────────────────────────────────────────────────────────

function InvoiceDocumentNotFound({ onClose }: { onClose?: () => void }) {
  return (
    <div
      className="flex h-full flex-col"
      data-testid="invoice-document-error"
      role="alert"
    >
      {/* Even in the error state we keep the close button on the left so the
          parent (a Sheet) always has a consistent way to dismiss. */}
      {onClose && (
        <div className="flex items-center border-b px-4 py-3 md:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close invoice"
            data-testid="invoice-close-button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-gray-50 p-8 text-center">
        <AlertCircle
          className="h-10 w-10 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-base font-medium text-gray-900">Invoice not found</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          This invoice may have been deleted or you may not have permission to
          view it.
        </p>
      </div>
    </div>
  );
}
