import { z } from "zod";

export const reportCardUploadSchema = z.object({
  enrollmentId: z.string().min(1, "Enrollment is required"),
  semester: z.enum(["1", "2"]),
  file: z
    .instanceof(File)
    .refine((f) => f.type === "application/pdf", "Only PDF files are allowed")
    .refine(
      (f) => f.size <= 5 * 1024 * 1024,
      "File must be 5MB or smaller"
    ),
  notes: z.string().optional(),
});

export type ReportCardUploadValues = z.infer<typeof reportCardUploadSchema>;
