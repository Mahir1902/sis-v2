/**
 * School brand strings shared by the on-screen invoice
 * (`components/shared/InvoiceDocument.tsx`) and the printable PDF
 * (`components/shared/InvoicePDF.tsx`). Keeping the name in one place means a
 * future rename or rebrand only touches this file.
 *
 * The campus address is intentionally NOT here — it varies per invoice and is
 * resolved server-side from the invoice's `campusId` (see
 * `convex/invoices.ts > getInvoiceById`).
 */
export const SCHOOL_NAME = "Singapore International School";
