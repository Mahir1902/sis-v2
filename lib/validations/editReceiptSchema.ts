import { z } from "zod";

/**
 * Zod schema for the cosmetic-edit dialog on `/receipts/[receiptId]`.
 *
 * Backs the `editReceipt` Convex mutation (issue #38 / ADR-0003). Admin can
 * correct a typo in any combination of `payerName`, `payerRole`, or `remarks`
 * without producing a new Receipt number and without changing the receipt
 * lifecycle.
 *
 * At least one field must be present — an empty patch is rejected so the
 * mutation never logs a no-op audit row.
 */

const payerRoles = ["father", "mother", "guardian"] as const;

export const editReceiptSchema = z
  .object({
    payerName: z
      .string()
      .trim()
      .min(1, "Payer name cannot be empty")
      .optional(),
    payerRole: z.enum(payerRoles).optional(),
    remarks: z
      .string()
      .trim()
      .max(500, "Remarks must be 500 characters or fewer")
      .optional(),
  })
  .refine(
    (data) =>
      data.payerName !== undefined ||
      data.payerRole !== undefined ||
      data.remarks !== undefined,
    { message: "Provide at least one field to edit." },
  );

export type EditReceiptValues = z.infer<typeof editReceiptSchema>;
