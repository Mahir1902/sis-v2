/**
 * Hardcoded V1 invoice email body templates (English only).
 *
 * Three templates drive the launcher Compose Email button (ADR-0001). Each is
 * a pure renderer over a fixed set of `{{variable}}` placeholders — no I/O,
 * no template engine. Body text matches issue #31 spec exactly so the rendered
 * output is what the admin sees when Gmail opens.
 *
 * Variable placement uses fixed-width column alignment ("Issue date:" + spaces
 * + value); keep the exact whitespace when editing or the alignment in the
 * Gmail preview will skew.
 */

function substitute(
  template: string,
  vars: Record<string, string | number> | object,
): string {
  const lookup = vars as Record<string, string | number | undefined>;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = lookup[key];
    return value === undefined ? match : String(value);
  });
}

export interface InitialInvoiceEmailVars {
  invoiceNumber: string;
  studentName: string;
  billingContactName: string;
  schoolName: string;
  standardLevel: string;
  issueDate: string;
  dueDate: string;
  amountDue: string;
}

const INITIAL_SUBJECT =
  "Invoice {{invoiceNumber}} for {{studentName}} — {{schoolName}}";

const INITIAL_BODY = `Dear {{billingContactName}},

Please find attached the fee invoice for {{studentName}} ({{standardLevel}}).

Invoice number: {{invoiceNumber}}
Issue date:     {{issueDate}}
Due date:       {{dueDate}}
Amount due:     BDT {{amountDue}}

Kindly arrange payment by the due date. If you have already paid
or have any questions, please contact the school office.

Thank you,
{{schoolName}} — Finance Office`;

export function renderInitialInvoiceEmail(vars: InitialInvoiceEmailVars): {
  subject: string;
  body: string;
} {
  return {
    subject: substitute(INITIAL_SUBJECT, vars),
    body: substitute(INITIAL_BODY, vars),
  };
}

export interface ReminderInvoiceEmailVars {
  invoiceNumber: string;
  studentName: string;
  billingContactName: string;
  schoolName: string;
  dueDate: string;
  balanceDue: string;
}

const REMINDER_SUBJECT =
  "Reminder — Invoice {{invoiceNumber}} outstanding for {{studentName}}";

const REMINDER_BODY = `Dear {{billingContactName}},

This is a reminder that the following invoice is still outstanding:

Invoice number:    {{invoiceNumber}}
Original due date: {{dueDate}}
Balance due:       BDT {{balanceDue}}

If you have already made the payment, please let us know so we can
update our records. Otherwise, kindly arrange payment at your
earliest convenience.

Thank you,
{{schoolName}} — Finance Office`;

export function renderReminderInvoiceEmail(vars: ReminderInvoiceEmailVars): {
  subject: string;
  body: string;
} {
  return {
    subject: substitute(REMINDER_SUBJECT, vars),
    body: substitute(REMINDER_BODY, vars),
  };
}

export interface ReceiptInvoiceEmailVars {
  invoiceNumber: string;
  studentName: string;
  billingContactName: string;
  schoolName: string;
  amountPaid: string;
  paidAt: string;
  paymentMode: string;
}

const RECEIPT_SUBJECT =
  "Receipt — Invoice {{invoiceNumber}} paid for {{studentName}}";

const RECEIPT_BODY = `Dear {{billingContactName}},

Thank you for your payment. Please find attached the receipt for
invoice {{invoiceNumber}}, marked as paid.

Invoice number: {{invoiceNumber}}
Amount paid:    BDT {{amountPaid}}
Payment date:   {{paidAt}}
Payment mode:   {{paymentMode}}

If you have any questions about this receipt, please contact the
school office.

Thank you,
{{schoolName}} — Finance Office`;

export function renderReceiptInvoiceEmail(vars: ReceiptInvoiceEmailVars): {
  subject: string;
  body: string;
} {
  return {
    subject: substitute(RECEIPT_SUBJECT, vars),
    body: substitute(RECEIPT_BODY, vars),
  };
}

export type InvoiceEmailTemplate = "initial" | "reminder" | "receipt";
