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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type DeliveryChannel = "email" | "in_person" | "phone" | "whatsapp" | "other";

type DeliveryStatus = "delivered" | "failed";

const CHANNEL_OPTIONS: { value: DeliveryChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "in_person", label: "In Person" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS: { value: DeliveryStatus; label: string }[] = [
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: Id<"invoices">;
  invoiceNumber: string;
}

/**
 * Records the admin's self-reported delivery attestation and transitions a
 * draft invoice to `issued`. Defaults to `email` + `delivered` (the common
 * case for the Compose Email launcher flow). Channel is required because the
 * downstream audit log relies on it being explicit.
 */
export function MarkAsIssuedDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
}: Props) {
  const [channel, setChannel] = useState<DeliveryChannel>("email");
  const [status, setStatus] = useState<DeliveryStatus>("delivered");
  const [isSaving, setIsSaving] = useState(false);
  const markAsIssued = useMutation(api.invoices.markAsIssued);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await markAsIssued({
        invoiceId,
        deliveryChannel: channel,
        deliveryStatus: status,
      });
      toast.success(`Invoice ${invoiceNumber} marked as issued`);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to mark invoice as issued";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark {invoiceNumber} as issued</DialogTitle>
          <DialogDescription>
            Record how this invoice was delivered. This transitions the invoice
            from draft to issued.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delivery-channel">Delivery channel</Label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel(v as DeliveryChannel)}
            >
              <SelectTrigger id="delivery-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-status">Delivery status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as DeliveryStatus)}
            >
              <SelectTrigger id="delivery-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            disabled={isSaving}
            className="bg-school-green text-white hover:bg-school-green/90"
          >
            {isSaving ? "Saving…" : "Mark as Issued"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
