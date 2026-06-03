import { z } from "zod";

// ── Generate-invoice form schema (used in GenerateInvoiceDialog) ─────────────

const NOTES_MAX = 500;

export const generateInvoiceFormSchema = z.object({
  dueDate: z.date({ message: "Due date is required" }),
  notes: z
    .string()
    .max(NOTES_MAX, `Notes must be ${NOTES_MAX} characters or fewer`)
    .optional(),
});

export type GenerateInvoiceFormValues = z.infer<
  typeof generateInvoiceFormSchema
>;
