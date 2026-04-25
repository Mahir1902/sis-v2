import { z } from "zod";

export const studentInfoBaseSchema = z.object({
  studentNumber: z.string().min(1, "Student number is required"),
  studentFullName: z.string().min(2, "Full name is required"),
  gender: z.enum(["Male", "Female"]),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  placeOfBirth: z.string().min(1, "Place of birth is required"),
  citizenship: z.string().min(1, "Citizenship is required"),
  religion: z.string().min(1, "Religion is required"),
  bloodGroup: z.string().min(1, "Blood group is required"),
  birthCertificateNumber: z
    .string()
    .min(1, "Birth certificate number is required"),
  passportNumber: z.string().optional(),
  passportValidTill: z.string().optional(),
  standardLevel: z.string().min(1, "Standard level is required"),
  academicYear: z.string().min(1, "Academic year is required"),
  campus: z.string().min(1, "Campus is required"),
  presentAddress: z.string().min(1, "Present address is required"),
  permanentAddress: z.string().optional(),
  previousSchoolName: z.string().optional(),
  previousSchoolAddress: z.string().optional(),
  hasHealthIssues: z.boolean(),
  healthIssueDescription: z.string().optional(),
  studentPhoto: z.instanceof(File).optional(),
});

export const studentInfoSchema = studentInfoBaseSchema.refine(
  (data) =>
    !data.hasHealthIssues ||
    (data.healthIssueDescription &&
      data.healthIssueDescription.trim().length > 0),
  {
    message: "Please describe the health issue",
    path: ["healthIssueDescription"],
  },
);

export type StudentInfoValues = z.infer<typeof studentInfoSchema>;
