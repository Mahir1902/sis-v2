import { z } from "zod";

// ── Admission form fees schema (used in student admission step) ──────────────

export const feesSchema = z.object({
  classStartDate: z.string().min(1, "Class start date is required"),
  consultantName: z.string().min(1, "Consultant name is required"),
  admissionFee: z.number().nullable().optional(),
  tuitionFee: z.number().nullable().optional(),
  registrationFee: z.number().nullable().optional(),
});

export type FeesValues = z.infer<typeof feesSchema>;

// ── Fee structure constants ──────────────────────────────────────────────────

export const feeTypes = [
  "admission",
  "tuition",
  "registration",
  "library",
  "sports",
  "computer",
] as const;

export const frequencies = ["one-time", "monthly", "yearly"] as const;

// ── Fee structure schemas (used in create/edit fee dialogs) ───────────────────

export const createFeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  feeType: z.enum(feeTypes),
  baseAmount: z.number().min(0, "Amount must be non-negative"),
  frequency: z.enum(frequencies),
  dueDate: z.string().optional(),
  lateFeeEnabled: z.boolean(),
  lateFeeAmount: z.number().optional(),
});

export type CreateFeeValues = z.infer<typeof createFeeSchema>;

export const editFeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  feeType: z.enum(feeTypes),
  baseAmount: z.number().min(0, "Amount must be non-negative"),
  frequency: z.enum(frequencies),
  dueDate: z.string().optional(),
  lateFeeEnabled: z.boolean(),
  lateFeeAmount: z.number().optional(),
});

export type EditFeeValues = z.infer<typeof editFeeSchema>;
