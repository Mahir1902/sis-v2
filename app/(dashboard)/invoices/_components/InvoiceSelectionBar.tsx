"use client";

import { Download, Loader2, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";

/**
 * Floating bulk-action bar for the invoices list.
 *
 * Becomes visible the moment the user checks at least one row in the table
 * and disappears the moment the selection drops to zero. Layout intentionally
 * mirrors the prototype's SelectionBar (`app/(dashboard)/invoices/prototype/`)
 * so what shipped in the PRD review is what the admin sees in production.
 *
 * Accessibility:
 *  - `role="region"` + `aria-live="polite"` lets screen readers announce
 *    "{count} invoices selected" without stealing focus.
 *  - The PDF button reflects `isGenerating` and disables to prevent
 *    overlapping bulk runs.
 *
 * Wiring scope for Issue #28:
 *  - PDF button is wired through to the parent's `onDownloadPdf`.
 *  - Send / Void surface "lands in follow-up issue" toasts from the parent —
 *    deliberately punted to keep this slice focused on PDF.
 */

interface InvoiceSelectionBarProps {
  /** Number of rows currently selected. When zero, the bar is hidden entirely. */
  count: number;
  /** Sum of `totalAmount` across selected rows (visible-rows-only is fine). */
  totalValue: number;
  onSend: () => void;
  onDownloadPdf: () => void;
  onVoid: () => void;
  onClear: () => void;
  /** True while the PDF download is in flight — disables the PDF button. */
  isGenerating?: boolean;
}

export function InvoiceSelectionBar({
  count,
  totalValue,
  onSend,
  onDownloadPdf,
  onVoid,
  onClear,
  isGenerating = false,
}: InvoiceSelectionBarProps) {
  if (count === 0) return null;

  return (
    // `<section>` (rather than a plain `<div role="region">`) is semantically
    // correct for a labelled landmark and silences biome's
    // `useSemanticElements` lint. The aria-live ensures screen readers
    // announce the selection count without stealing focus.
    <section
      aria-live="polite"
      aria-label={`${count} invoice${count === 1 ? "" : "s"} selected`}
      data-testid="invoice-selection-bar"
      className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-in slide-in-from-bottom-4"
    >
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-xl">
        <span className="text-sm font-semibold text-gray-900">
          {count} selected
        </span>
        <span className="text-sm text-muted-foreground">
          · {formatCurrency(totalValue)}
        </span>
        <div className="mx-1 h-4 w-px bg-gray-200" aria-hidden="true" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onSend}
          aria-label="Send selected invoices to parents"
          data-testid="invoice-selection-bar-send"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" /> Send
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onDownloadPdf}
          disabled={isGenerating}
          aria-label="Download selected invoices as PDFs"
          data-testid="invoice-selection-bar-pdf"
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          )}{" "}
          PDF
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-700"
          onClick={onVoid}
          aria-label="Void selected invoices"
          data-testid="invoice-selection-bar-void"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Void
        </Button>
        <div className="mx-1 h-4 w-px bg-gray-200" aria-hidden="true" />
        <button
          type="button"
          onClick={onClear}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-gray-100 hover:text-gray-700"
          aria-label="Clear selection"
          data-testid="invoice-selection-bar-clear"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
