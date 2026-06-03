"use client";

import { InvoiceDocument } from "@/components/shared/InvoiceDocument";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Id } from "@/convex/_generated/dataModel";
import { InvoiceActionsToolbar } from "./InvoiceActionsToolbar";

/**
 * Side-panel preview Sheet for a single invoice (Issue #29).
 *
 * Thin wrapper around `InvoiceDocument`:
 *   - No data fetching or business logic — `InvoiceDocument` owns that.
 *   - Open state is controlled by the parent via `invoiceId` (non-null = open).
 *   - `showCloseButton={false}` — the close affordance lives on the LEFT of
 *     `InvoiceDocument`'s toolbar (see InvoiceDocument.tsx Toolbar).
 *   - Hidden `SheetTitle` + `SheetDescription` satisfy Radix Dialog's a11y
 *     requirement; the visible header is rendered by `InvoiceDocument`.
 *   - Mobile-first: full width on phones, capped at 672px on sm+ viewports.
 *
 * `onPrint` / `onSend` are intentionally not passed through — those actions
 * belong to other issues. InvoiceDocument renders them disabled, which is the
 * correct UX for the preview while wiring is pending.
 */
interface InvoicePreviewSheetProps {
  invoiceId: Id<"invoices"> | null;
  onClose: () => void;
}

export function InvoicePreviewSheet({
  invoiceId,
  onClose,
}: InvoicePreviewSheetProps) {
  return (
    <Sheet
      open={invoiceId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full overflow-y-auto p-0 sm:max-w-[672px]"
      >
        {/* Required for Radix Dialog a11y. The visible title is part of the
            InvoiceDocument body; keep these visually hidden. */}
        <SheetHeader className="sr-only">
          <SheetTitle>Invoice preview</SheetTitle>
          <SheetDescription>
            Preview of the selected invoice document.
          </SheetDescription>
        </SheetHeader>
        {invoiceId !== null && (
          <InvoiceDocument
            invoiceId={invoiceId}
            onClose={onClose}
            actions={<InvoiceActionsToolbar invoiceId={invoiceId} />}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
