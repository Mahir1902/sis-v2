/**
 * Locked email-template strings for the Money Receipt launcher (issue #37).
 *
 * The subject and body are reproduced verbatim from the issue body and pinned
 * by string equality in `receiptTemplates.test.ts` — any future copy edit
 * shows up as a diff on the test, never as a silent UX drift.
 *
 * Pure — no Convex, no DOM. Composed at click time on the receipts detail page
 * before being handed to `buildGmailComposeUrl`.
 */

export interface ReceiptEmailSubjectArgs {
  receiptNumber: string;
  schoolName: string;
}

export function receiptEmailSubject(args: ReceiptEmailSubjectArgs): string {
  return `Money Receipt ${args.receiptNumber} — ${args.schoolName}`;
}

export interface ReceiptEmailBodyArgs {
  payerName: string;
  paymentDate: string;
  totalAmount: string;
  studentName: string;
  schoolName: string;
}

export function receiptEmailBody(args: ReceiptEmailBodyArgs): string {
  return [
    `Dear ${args.payerName},`,
    "",
    "Please find attached the Money Receipt for the payment received on",
    `${args.paymentDate} totaling BDT ${args.totalAmount} for ${args.studentName}.`,
    "",
    "If you have any questions, please reply to this email or contact",
    "the school office.",
    "",
    "Thank you,",
    args.schoolName,
  ].join("\n");
}
