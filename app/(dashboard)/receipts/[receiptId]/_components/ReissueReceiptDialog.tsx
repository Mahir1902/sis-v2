"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  paymentModes,
  type ReissueReceiptValues,
  reissueReceiptSchema,
} from "@/lib/validations/receiptCorrectionSchema";

interface ReissueReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  receipt: Doc<"receipts">;
}

const toInputDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Void and re-issue (ADR-0003): corrects payment method, date or remarks.
 * The old receipt is voided and a new numbered receipt for the same fees is
 * issued in one atomic mutation; the two are cross-linked.
 */
export function ReissueReceiptDialog({
  open,
  onClose,
  receipt,
}: ReissueReceiptDialogProps) {
  const router = useRouter();
  const reissue = useMutation(api.receipts.voidAndReissueReceipt);
  const form = useForm<ReissueReceiptValues>({
    resolver: zodResolver(reissueReceiptSchema),
    defaultValues: {
      reason: "",
      paymentMode: receipt.paymentMethod,
      paymentDate: toInputDate(receipt.paymentDate),
      remarks: receipt.remarks ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        reason: "",
        paymentMode: receipt.paymentMethod,
        paymentDate: toInputDate(receipt.paymentDate),
        remarks: receipt.remarks ?? "",
      });
    }
  }, [open, receipt, form]);

  async function onSubmit(values: ReissueReceiptValues) {
    try {
      const result = await reissue({
        receiptId: receipt._id,
        reason: values.reason,
        paymentMode: values.paymentMode,
        paymentDate: values.paymentDate
          ? new Date(`${values.paymentDate}T12:00:00`).getTime()
          : undefined,
        remarks: values.remarks === "" ? undefined : values.remarks,
      });
      toast.success(`Re-issued as ${result.receiptNumber}`, {
        description: `${receipt.receiptNumber} is now voided.`,
      });
      onClose();
      router.push(`/receipts/${result.receiptId}`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to re-issue receipt",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void &amp; Re-issue {receipt.receiptNumber}</DialogTitle>
          <DialogDescription>
            Correct the payment method, date or remarks. This receipt is voided
            and a new one for the same fees is issued with a new number; both
            documents reference each other.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="paymentMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Select payment method">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paymentModes.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value ?? ""}
                      aria-label="Payment date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={2}
                      aria-label="Remarks"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for correction</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      placeholder="e.g. Paid by bank transfer, recorded as cash"
                      aria-label="Reason for re-issue"
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
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Re-issuing…"
                  : "Void & Re-issue"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
