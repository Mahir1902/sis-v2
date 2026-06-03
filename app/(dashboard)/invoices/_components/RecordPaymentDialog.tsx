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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type PaymentMode = "Cash" | "Bank Transfer" | "Cheque" | "UPI" | "Online";

const PAYMENT_MODE_OPTIONS: PaymentMode[] = [
  "Cash",
  "Bank Transfer",
  "Cheque",
  "UPI",
  "Online",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: Id<"invoices">;
  invoiceNumber: string;
  /** Outstanding balance — used to default the amount and clamp validation. */
  balance: number;
}

/**
 * Records a payment against an outstanding invoice (issue #31 Part B).
 *
 * Amount defaults to the full outstanding balance (most common case: parent
 * paid the full invoice). Partial payments are accepted as long as the
 * amount is positive and does not exceed the balance.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  balance,
}: Props) {
  const [amount, setAmount] = useState<string>(balance.toString());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const recordPayment = useMutation(api.invoices.recordInvoicePayment);

  const parsedAmount = Number.parseFloat(amount);
  const amountInvalid =
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0 ||
    parsedAmount > balance;

  const handleConfirm = async () => {
    if (amountInvalid) {
      setError(
        parsedAmount > balance
          ? "Amount exceeds the outstanding balance"
          : "Enter a positive payment amount",
      );
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await recordPayment({
        invoiceId,
        amount: parsedAmount,
        paymentMode,
        referenceNumber:
          referenceNumber.trim().length > 0
            ? referenceNumber.trim()
            : undefined,
        remarks: remarks.trim().length > 0 ? remarks.trim() : undefined,
      });
      toast.success(`Payment recorded for ${invoiceNumber}`);
      onOpenChange(false);
      // Reset form so re-opening starts fresh.
      setAmount(balance.toString());
      setReferenceNumber("");
      setRemarks("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to record payment";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment — {invoiceNumber}</DialogTitle>
          <DialogDescription>
            Outstanding balance: {formatCurrency(balance)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount (BDT)</Label>
            <Input
              id="payment-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={amountInvalid}
              aria-describedby={error ? "payment-amount-error" : undefined}
            />
            {error && (
              <p
                id="payment-amount-error"
                className="text-sm text-red-600"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-mode">Payment mode</Label>
            <Select
              value={paymentMode}
              onValueChange={(v) => setPaymentMode(v as PaymentMode)}
            >
              <SelectTrigger id="payment-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODE_OPTIONS.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-reference">
              Reference number (optional)
            </Label>
            <Input
              id="payment-reference"
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. cheque or transaction id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-remarks">Remarks (optional)</Label>
            <Textarea
              id="payment-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Add any notes about this payment"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving || amountInvalid}
            className="bg-school-green text-white hover:bg-school-green/90"
          >
            {isSaving ? "Recording…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
