"use client";

import { CircleCheck, Mail, Receipt as ReceiptIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { useInvoiceDocument } from "@/hooks/use-invoice-document";
import { buildGmailComposeUrl } from "@/lib/composeEmailUrl";
import { fmtDayMonthYear } from "@/lib/dateFormat";
import {
  type InvoiceEmailTemplate,
  renderInitialInvoiceEmail,
  renderReceiptInvoiceEmail,
  renderReminderInvoiceEmail,
} from "@/lib/invoiceEmailTemplates";
import { SCHOOL_NAME } from "@/lib/schoolBrand";
import { AddBillingEmailDialog } from "./AddBillingEmailDialog";
import { MarkAsIssuedDialog } from "./MarkAsIssuedDialog";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

/**
 * Renders the right-hand action buttons for the invoice document toolbar:
 *   - Compose Email / Compose Reminder / Email Receipt — status-driven label.
 *   - Mark as Issued — only when status is `draft`.
 *   - Record Payment — only when status is `issued` or `overdue`.
 *
 * All dialogs needed by these actions are embedded here so the toolbar slot
 * stays a single ReactNode for the parent. The component subscribes to the
 * same `getInvoiceById` query as `InvoiceDocument` — Convex de-dupes the
 * subscription so there is no extra fetch.
 *
 * Returns null while the invoice loads / 404s so the toolbar layout stays
 * stable but no buttons flash in.
 */
export function InvoiceActionsToolbar({
  invoiceId,
}: {
  invoiceId: Id<"invoices">;
}) {
  const result = useInvoiceDocument(invoiceId);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [markAsIssuedOpen, setMarkAsIssuedOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);

  if (result.state !== "ready") return null;
  const { invoice, status } = result;

  // Compose Email is hidden for voided invoices entirely (ADR-0001).
  if (status === "voided") {
    return <div data-testid="invoice-actions-voided" />;
  }

  const template = pickTemplate(status);
  const composeLabel = composeButtonLabel(status);
  const billingContact = invoice.billingContact;
  const hasEmail = billingContact.hasEmail;

  const handleCompose = () => {
    if (!hasEmail) {
      setEmailDialogOpen(true);
      return;
    }
    const composed = renderTemplate(template, invoice);
    const url = buildGmailComposeUrl({
      to: billingContact.email ?? "",
      subject: composed.subject,
      body: composed.body,
    });
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success(
      "Gmail tab opened. PDF saved to your Downloads folder — drag it into the email.",
      { duration: 6000 },
    );
  };

  return (
    <>
      <div
        className="flex items-center gap-2"
        data-testid="invoice-actions-toolbar"
      >
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-xs"
          onClick={handleCompose}
          aria-label={composeLabel}
          data-testid="invoice-compose-email-button"
          data-compose-template={template}
        >
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          {composeLabel}
        </Button>
        {status === "draft" && (
          <Button
            size="sm"
            className="gap-1.5 bg-school-green text-xs text-white hover:bg-school-green/90"
            onClick={() => setMarkAsIssuedOpen(true)}
            aria-label="Mark invoice as issued"
            data-testid="invoice-mark-issued-button"
          >
            <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark as
            Issued
          </Button>
        )}
        {(status === "issued" || status === "overdue") && (
          <Button
            size="sm"
            className="gap-1.5 bg-school-green text-xs text-white hover:bg-school-green/90"
            onClick={() => setRecordPaymentOpen(true)}
            aria-label="Record a payment for this invoice"
            data-testid="invoice-record-payment-button"
          >
            <ReceiptIcon className="h-3.5 w-3.5" aria-hidden="true" /> Record
            Payment
          </Button>
        )}
      </div>

      <AddBillingEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        studentId={invoice.studentId}
        contactType={billingContact.contactType}
        contactName={billingContact.name}
        onSaved={(savedEmail) => {
          const composed = renderTemplate(template, invoice);
          const url = buildGmailComposeUrl({
            to: savedEmail,
            subject: composed.subject,
            body: composed.body,
          });
          window.open(url, "_blank", "noopener,noreferrer");
          toast.success(
            "Gmail tab opened. PDF saved to your Downloads folder — drag it into the email.",
            { duration: 6000 },
          );
        }}
      />

      <MarkAsIssuedDialog
        open={markAsIssuedOpen}
        onOpenChange={setMarkAsIssuedOpen}
        invoiceId={invoiceId}
        invoiceNumber={invoice.invoiceNumber}
      />

      <RecordPaymentDialog
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        invoiceId={invoiceId}
        invoiceNumber={invoice.invoiceNumber}
        balance={invoice.balance}
      />
    </>
  );
}

// ── Template selection ──────────────────────────────────────────────────────

// Formats an amount for an email body. Templates print the "BDT" prefix
// themselves, so we emit just the numeric portion with thousands separators
// (Indian/Bangladeshi grouping matches the rest of the UI's formatCurrency).
function fmtEmailAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function pickTemplate(status: string): InvoiceEmailTemplate {
  if (status === "issued" || status === "overdue") return "reminder";
  if (status === "paid") return "receipt";
  return "initial";
}

function composeButtonLabel(status: string): string {
  if (status === "issued" || status === "overdue") return "Compose Reminder";
  if (status === "paid") return "Email Receipt";
  return "Compose Email";
}

interface ComposeInvoice {
  invoiceNumber: string;
  studentName: string;
  standardLevelName: string;
  issueDate: number;
  dueDate: number;
  totalAmount: number;
  balance: number;
  paidAmount: number;
  billingContact: { name: string };
}

function renderTemplate(
  template: InvoiceEmailTemplate,
  invoice: ComposeInvoice,
): { subject: string; body: string } {
  const billingContactName = invoice.billingContact.name;
  if (template === "initial") {
    return renderInitialInvoiceEmail({
      invoiceNumber: invoice.invoiceNumber,
      studentName: invoice.studentName,
      billingContactName,
      schoolName: SCHOOL_NAME,
      standardLevel: invoice.standardLevelName,
      issueDate: fmtDayMonthYear(invoice.issueDate),
      dueDate: fmtDayMonthYear(invoice.dueDate),
      amountDue: fmtEmailAmount(invoice.totalAmount),
    });
  }
  if (template === "reminder") {
    return renderReminderInvoiceEmail({
      invoiceNumber: invoice.invoiceNumber,
      studentName: invoice.studentName,
      billingContactName,
      schoolName: SCHOOL_NAME,
      dueDate: fmtDayMonthYear(invoice.dueDate),
      balanceDue: fmtEmailAmount(invoice.balance),
    });
  }
  // receipt — paid invoice. The latest payment timestamp would be ideal but
  // is not directly on the document; fall back to issueDate (the receipt
  // notes the body line "Payment date" purely informatively).
  return renderReceiptInvoiceEmail({
    invoiceNumber: invoice.invoiceNumber,
    studentName: invoice.studentName,
    billingContactName,
    schoolName: SCHOOL_NAME,
    amountPaid: fmtEmailAmount(invoice.paidAmount),
    paidAt: fmtDayMonthYear(Date.now()),
    paymentMode: "—",
  });
}
