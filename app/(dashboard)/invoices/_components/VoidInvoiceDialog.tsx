"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface Props {
  invoiceId: Id<"invoices"> | null;
  invoiceNumber: string | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmation dialog for the destructive "void invoice" action.
 *
 * Accepts an optional free-text reason — sent to the mutation as `reason` so
 * the audit log captures why the void happened. Server-side rules:
 *   - `paid` invoices cannot be voided (the action is disabled in the menu
 *     before the dialog ever opens).
 *   - Already-voided invoices cannot be re-voided.
 *
 * Success/error both surface via Sonner toast. The parent owns whether the
 * dialog is open by passing `invoiceId` (null = closed).
 */
export function VoidInvoiceDialog({
  invoiceId,
  invoiceNumber,
  onOpenChange,
}: Props) {
  const voidInvoice = useMutation(api.invoices.voidInvoice);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const open = invoiceId !== null;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setReason("");
      setIsSubmitting(false);
    }
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!invoiceId) return;
    setIsSubmitting(true);
    try {
      await voidInvoice({
        invoiceId,
        reason: reason.trim() === "" ? undefined : reason.trim(),
      });
      toast.success(
        invoiceNumber
          ? `Invoice ${invoiceNumber} has been voided`
          : "Invoice has been voided",
      );
      handleOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to void invoice";
      toast.error(message);
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void invoice {invoiceNumber ?? ""}</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The invoice will remain in the system
            for the audit trail but will be excluded from outstanding and
            overdue totals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="void-reason">Reason (optional)</Label>
          <Textarea
            id="void-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. issued in error, replaced by INV-2025-014"
            rows={3}
            disabled={isSubmitting}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {isSubmitting ? "Voiding…" : "Void invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
