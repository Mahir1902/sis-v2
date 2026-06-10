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
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  type EditReceiptValues,
  editReceiptSchema,
} from "@/lib/validations/editReceiptSchema";

interface CosmeticEditDialogProps {
  open: boolean;
  onClose: () => void;
  receipt: Doc<"receipts">;
}

const PAYER_ROLE_OPTIONS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "guardian", label: "Guardian" },
] as const;

export function CosmeticEditDialog({
  open,
  onClose,
  receipt,
}: CosmeticEditDialogProps) {
  const editReceipt = useMutation(api.receipts.editReceipt);

  const form = useForm<EditReceiptValues>({
    resolver: zodResolver(editReceiptSchema),
    defaultValues: {
      payerName: receipt.payerName,
      payerRole: receipt.payerRole,
      remarks: receipt.remarks ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        payerName: receipt.payerName,
        payerRole: receipt.payerRole,
        remarks: receipt.remarks ?? "",
      });
    }
  }, [open, receipt, form]);

  async function onSubmit(values: EditReceiptValues) {
    try {
      const normalizedRemarks =
        values.remarks === "" ? undefined : values.remarks;
      await editReceipt({
        receiptId: receipt._id as Id<"receipts">,
        payerName: values.payerName,
        payerRole: values.payerRole,
        remarks: normalizedRemarks,
      });
      toast.success("Receipt updated");
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update receipt";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Receipt</DialogTitle>
          <DialogDescription>
            Correct a typo in the payer name, role, or remarks. The Receipt
            number and lifecycle are unchanged. Changes are recorded in the
            audit log.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="payerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payer Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      aria-label="Payer name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payerRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payer Role</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Select payer role">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYER_ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
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
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={3}
                      placeholder="Optional notes"
                      aria-label="Remarks"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-school-green hover:bg-school-green/90 text-white"
                disabled={form.formState.isSubmitting}
                aria-label="Save receipt changes"
              >
                {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
