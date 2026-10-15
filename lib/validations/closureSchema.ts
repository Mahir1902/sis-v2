import { z } from "zod";
import { isDateLabel } from "../attendanceDate";

/** The /admin/calendar add-closure form (attendance spec §5.7). */
export const closureSchema = z
  .object({
    startDate: z.string().refine(isDateLabel, "Pick a start date."),
    endDate: z.string().refine(isDateLabel, "Pick an end date."),
    reason: z.string().trim().min(1, "Say why the school is closed."),
    campuses: z.array(z.string()).min(1, "Tick at least one campus."),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "End date must not be before the start date.",
    path: ["endDate"],
  });

export type ClosureValues = z.infer<typeof closureSchema>;
