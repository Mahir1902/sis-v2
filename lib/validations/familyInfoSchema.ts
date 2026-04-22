import { z } from "zod";

const siblingSchema = z.object({
  name: z.string().min(1),
  standardLevelId: z.string().min(1),
  campus: z.string().min(1),
});

export const familyInfoSchema = z.object({
  fatherName: z.string().min(1, "Father's name is required"),
  fatherOccupation: z.string().min(1, "Father's occupation is required"),
  fatherNidNumber: z.string().min(1, "Father's NID number is required"),
  fatherPhoneNumber: z.string().min(1, "Father's phone number is required"),
  fatherPhoto: z.instanceof(File).optional(),

  motherName: z.string().min(1, "Mother's name is required"),
  motherOccupation: z.string().min(1, "Mother's occupation is required"),
  motherNidNumber: z.string().min(1, "Mother's NID number is required"),
  motherPhoneNumber: z.string().min(1, "Mother's phone number is required"),
  motherPhoto: z.instanceof(File).optional(),

  guardianName: z.string().min(1, "Guardian's name is required"),
  guardianRelation: z.string().min(1, "Guardian's relation is required"),
  guardianNidNumber: z.string().min(1, "Guardian's NID number is required"),
  guardianPhoneNumber: z.string().min(1, "Guardian's phone number is required"),

  familyAnnualIncome: z.string().min(1, "Family annual income is required"),
  siblings: z.array(siblingSchema).optional(),
});

export type FamilyInfoValues = z.infer<typeof familyInfoSchema>;
