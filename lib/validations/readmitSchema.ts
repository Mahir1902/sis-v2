import { z } from "zod";

/** Re-admission: the class a leaver is placed into (a new enrollment). */
export const readmitSchema = z.object({
  standardLevelId: z.string().min(1, "Standard level is required"),
  academicYear: z.string().min(1, "Academic year is required"),
  campus: z.string().min(1, "Campus is required"),
});

export type ReadmitValues = z.infer<typeof readmitSchema>;
