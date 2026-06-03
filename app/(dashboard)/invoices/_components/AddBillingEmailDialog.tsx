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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PrimaryBillingContact } from "@/lib/resolveBillingContact";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: Id<"students">;
  contactType: PrimaryBillingContact;
  contactName: string;
  /**
   * Called after a successful save. The parent uses this to immediately
   * re-trigger the Compose Email flow so the admin doesn't lose their place.
   */
  onSaved?: (email: string) => void;
}

const CONTACT_LABEL: Record<PrimaryBillingContact, string> = {
  father: "father",
  mother: "mother",
  guardian: "guardian",
};

/**
 * Inline email-capture modal for the Compose Email "Add Email" affordance.
 * Single text field, format-validated client-side, saves to the student's
 * `{contactType}Email` field via `updateBillingContactEmail`.
 *
 * Does NOT change `primaryBillingContact`; only fills in the missing email
 * for whichever contact is already designated.
 */
export function AddBillingEmailDialog({
  open,
  onOpenChange,
  studentId,
  contactType,
  contactName,
  onSaved,
}: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const updateEmail = useMutation(api.students.updateBillingContactEmail);

  const handleSave = async () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Please enter a valid email address");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await updateEmail({ studentId, contactType, email: trimmed });
      toast.success(`Email saved for ${CONTACT_LABEL[contactType]}`);
      onOpenChange(false);
      setEmail("");
      onSaved?.(trimmed);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save email";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEmail("");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add email for {contactName}</DialogTitle>
          <DialogDescription>
            We need an email address for the {CONTACT_LABEL[contactType]}{" "}
            (Billing Contact) before we can open the Gmail composer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="billing-contact-email">Email address</Label>
          <Input
            id="billing-contact-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="parent@example.com"
            autoFocus
            aria-invalid={error !== null}
            aria-describedby={error ? "billing-contact-email-error" : undefined}
          />
          {error && (
            <p
              id="billing-contact-email-error"
              className="text-sm text-red-600"
              role="alert"
            >
              {error}
            </p>
          )}
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
            onClick={handleSave}
            disabled={isSaving || email.trim().length === 0}
            className="bg-school-green text-white hover:bg-school-green/90"
          >
            {isSaving ? "Saving…" : "Save Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
