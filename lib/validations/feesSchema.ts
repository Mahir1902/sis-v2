import { z } from "zod";

export const feesSchema = z.object({
  classStartDate: z.string().min(1, "Class start date is required"),
  consultantName: z.string().min(1, "Consultant name is required"),
  admissionFee: z.number().nullable().optional(),
  tuitionFee: z.number().nullable().optional(),
  registrationFee: z.number().nullable().optional(),
});

export type FeesValues = z.infer<typeof feesSchema>;
