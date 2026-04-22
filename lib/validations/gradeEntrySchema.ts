import { z } from "zod";

export const gradeEntrySchema = z
  .object({
    subjectId: z.string().min(1, "Subject is required"),
    marksObtained: z.number().min(0, "Marks cannot be negative"),
    totalMarks: z.number().min(1, "Total marks must be at least 1"),
    semester: z.enum(["1", "2"]),
    remarks: z.string().optional(),
  })
  .refine((data) => data.marksObtained <= data.totalMarks, {
    message: "Marks obtained cannot exceed total marks",
    path: ["marksObtained"],
  });

export type GradeEntryValues = z.infer<typeof gradeEntrySchema>;
