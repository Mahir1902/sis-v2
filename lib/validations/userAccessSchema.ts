import { z } from "zod";
import { GRANTABLE_CAPABILITIES, ROLES } from "@/lib/accessPolicy";

/**
 * The "Manage access" sheet (Settings → Users): an account's role, the student
 * record a student account is linked to, and a teacher's extra features.
 * `studentId` is "" when no student is picked; it only matters for a student.
 */
export const userAccessSchema = z
  .object({
    role: z.enum(ROLES),
    studentId: z.string(),
    grants: z.array(z.enum(GRANTABLE_CAPABILITIES)),
  })
  .refine((values) => values.role !== "student" || values.studentId !== "", {
    path: ["studentId"],
    message: "Pick the student this account belongs to.",
  });

export type UserAccessValues = z.infer<typeof userAccessSchema>;
