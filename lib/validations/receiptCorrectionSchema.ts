import { z } from "zod";

/**
 * Zod schemas for the two financial corrections on `/receipts/[receiptId]`
 * (ADR-0003). Both require a reason — it is stored in the audit log and is
 * the admin's explanation for why a numbered, parent-held document changed.
 */

export const paymentModes = [
  "Cash",
  "Bank Transfer",
  "Cheque",
  "UPI",
  "Online",
] as const;

const reason = z
  .string()
  .trim()
  .min(3, "Give a short reason (at least 3 characters)")
  .max(300, "Reason must be 300 characters or fewer");

export const voidReceiptSchema = z.object({ reason });
export type VoidReceiptValues = z.infer<typeof voidReceiptSchema>;

export const reissueReceiptSchema = z.object({
  reason,
  paymentMode: z.enum(paymentModes),
  /** "YYYY-MM-DD" from a native date input; empty keeps today's date. */
  paymentDate: z.string().optional(),
  remarks: z
    .string()
    .trim()
    .max(500, "Remarks must be 500 characters or fewer")
    .optional(),
});
export type ReissueReceiptValues = z.infer<typeof reissueReceiptSchema>;
