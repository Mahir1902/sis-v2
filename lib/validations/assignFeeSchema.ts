import { z } from "zod";

const frequencies = ["one-time", "monthly", "yearly"] as const;

/**
 * Zod schema for the Assign Fee dialog form.
 *
 * When frequency is "monthly", a billing period (YYYY-MM) is required.
 * For one-time and yearly fees, billingPeriod is optional/ignored.
 */
export const assignFeeSchema = z
  .object({
    feeStructureId: z.string().min(1, "Please select a fee structure"),
    frequency: z.enum(frequencies),
    billingPeriod: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.frequency === "monthly") {
        return !!data.billingPeriod && data.billingPeriod.length > 0;
      }
      return true;
    },
    {
      message: "Please select a billing month",
      path: ["billingPeriod"],
    },
  );

export type AssignFeeValues = z.infer<typeof assignFeeSchema>;
