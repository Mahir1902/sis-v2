"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";
import {
  type VoidReceiptValues,
  voidReceiptSchema,
} from "@/lib/validations/receiptCorrectionSchema";

interface VoidReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  receipt: Doc<"receipts">;
}

/**
 * Whole-receipt void (ADR-0003): "this payment never happened". No
 * replacement document — for a financial correction use the re-issue dialog.
 */
export function VoidReceiptDialog({
  open,
  onClose,
  receipt,
}: VoidReceiptDialogProps) {
  const voidReceipt = useMutation(api.receipts.voidReceipt);
  const form = useForm<VoidReceiptValues>({
    resolver: zodResolver(voidReceiptSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (open) form.reset({ reason: "" });
  }, [open, form]);

  async function onSubmit(values: VoidReceiptValues) {
    try {
      await voidReceipt({ receiptId: receipt._id, reason: values.reason });
      toast.success(`Receipt ${receipt.receiptNumber} voided`, {
        description: "Every fee on it is unpaid again.",
      });
      onClose();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to void receipt",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void Receipt {receipt.receiptNumber}</DialogTitle>
          <DialogDescription>
            Use this when the payment of {formatCurrency(receipt.totalAmount)}{" "}
            never happened. The receipt and its collection are voided, every fee
            on it goes back to unpaid, and no replacement is issued. This cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="e.g. Recorded against the wrong student"
                      aria-label="Reason for voiding"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Voiding…" : "Void Receipt"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
