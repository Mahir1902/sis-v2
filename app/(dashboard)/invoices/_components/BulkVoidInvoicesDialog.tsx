"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  formatBulkVoidMessage,
  summarizeBulkVoidResults,
} from "@/lib/bulkVoidInvoices";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceIds: Id<"invoices">[];
  onSuccess: () => void;
}

/**
 * Bulk-void confirmation dialog.
 *
 * Parallels the per-row `VoidInvoiceDialog` but runs `voidInvoice` for every
 * selected id in parallel via `Promise.allSettled` — partial success is the
 * normal outcome (e.g. a paid invoice slipped into the selection). The Sonner
 * toast tone is driven by the pure helpers in `lib/bulkVoidInvoices.ts` so the
 * messaging logic is unit-tested independently of the UI.
 *
 * On any success we call `onSuccess()` so the parent can clear the selection;
 * on total failure we leave the selection intact so the user can retry.
 */
export function BulkVoidInvoicesDialog({
  open,
  onOpenChange,
  invoiceIds,
  onSuccess,
}: Props) {
  const voidInvoice = useMutation(api.invoices.voidInvoice);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const count = invoiceIds.length;

  function handleOpenChange(next: boolean) {
    if (isSubmitting) return; // prevent close mid-flight
    if (!next) {
      setReason("");
    }
    onOpenChange(next);
  }

  async function handleConfirm() {
    // Bail out cleanly if there's nothing to void — never call the mutation.
    if (count === 0) {
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    const trimmedReason = reason.trim() === "" ? undefined : reason.trim();

    const results = await Promise.allSettled(
      invoiceIds.map((invoiceId) =>
        voidInvoice({ invoiceId, reason: trimmedReason }),
      ),
    );

    const summary = summarizeBulkVoidResults(results);
    const { tone, message } = formatBulkVoidMessage(summary);

    // Surface the first unique failure reason as the toast description, so
    // partial failures are diagnosable without opening the console.
    const firstUniqueReason =
      summary.failureReasons.length > 0
        ? Array.from(new Set(summary.failureReasons))[0]
        : undefined;
    const description = firstUniqueReason ? firstUniqueReason : undefined;

    if (tone === "success") {
      toast.success(message, description ? { description } : undefined);
    } else if (tone === "warning") {
      toast.warning(message, description ? { description } : undefined);
    } else {
      toast.error(message, description ? { description } : undefined);
    }

    setIsSubmitting(false);

    if (summary.succeeded > 0) {
      setReason("");
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Void selected invoices</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to void {count} {count === 1 ? "invoice" : "invoices"}
            . This action cannot be undone. Voided invoices remain in the system
            for the audit trail but are excluded from outstanding and overdue
            totals.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="bulk-void-reason">Reason (optional)</Label>
          <Textarea
            id="bulk-void-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. issued in error, replaced by new invoice batch"
            rows={3}
            disabled={isSubmitting}
            aria-label="Reason for voiding the selected invoices"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isSubmitting}
            aria-label="Cancel bulk void"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // keep dialog open until mutations settle
              void handleConfirm();
            }}
            disabled={isSubmitting || count === 0}
            className="bg-red-600 text-white hover:bg-red-700"
            aria-label={`Void ${count} selected ${count === 1 ? "invoice" : "invoices"}`}
          >
            {isSubmitting
              ? "Voiding…"
              : `Void ${count} ${count === 1 ? "invoice" : "invoices"}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
