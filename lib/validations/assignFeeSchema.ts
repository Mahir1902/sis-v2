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

/**
 * Builds the mutation payload from a selected fee structure and optional billing period.
 *
 * Always creates an unpaid fee with balance equal to baseAmount.
 */
export function resolveAssignFeePayload(
  structure: {
    _id: string;
    baseAmount: number;
    frequency: "one-time" | "monthly" | "yearly";
  },
  billingPeriod: string | undefined,
) {
  return {
    feeStructureId: structure._id,
    originalAmount: structure.baseAmount,
    paidAmount: 0,
    balance: structure.baseAmount,
    status: "unpaid" as const,
    billingPeriod,
  };
}
