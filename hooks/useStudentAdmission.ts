"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { familyInfoSchema } from "@/lib/validations/familyInfoSchema";
import { feesSchema } from "@/lib/validations/feesSchema";
import { studentInfoBaseSchema } from "@/lib/validations/studentInfoSchema";

const admissionSchema = studentInfoBaseSchema
  .merge(familyInfoSchema)
  .merge(feesSchema)
  .refine(
    (data) =>
      !data.hasHealthIssues ||
      (data.healthIssueDescription &&
        data.healthIssueDescription.trim().length > 0),
    {
      message: "Please describe the health issue",
      path: ["healthIssueDescription"],
    },
  );

export type AdmissionValues = z.infer<typeof admissionSchema>;

async function uploadFileToStorage(
  file: File,
  generateUrl: () => Promise<string>,
): Promise<Id<"_storage"> | null> {
  if (!file) return null;
  const url = await generateUrl();
  const res = await fetch(url, {
    method: "POST",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) throw new Error("Upload failed");
  const { storageId } = await res.json();
  return storageId as Id<"_storage">;
}

/**
 * Hook encapsulating all mutation/upload logic for the student admission form.
 * Returns submitAdmission and isSubmitting — form state stays in the component.
 */
export function useStudentAdmission(onSuccess: () => void) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateUrl = useMutation(api.students.generateStudentPhotoUrl);
  const createStudent = useMutation(api.students.createStudent);
  const createEnrollment = useMutation(api.enrollments.createEnrollment);
  const createStudentFee = useMutation(api.studentFees.createStudentFee);
  const feeStructures = useQuery(api.feeStructure.list);

  async function submitAdmission(values: AdmissionValues) {
    setIsSubmitting(true);
    try {
      // Upload photos in parallel
      const [studentPhotoId, fatherPhotoId, motherPhotoId] = await Promise.all([
        values.studentPhoto
          ? uploadFileToStorage(values.studentPhoto, generateUrl)
          : Promise.resolve(null),
        values.fatherPhoto
          ? uploadFileToStorage(values.fatherPhoto, generateUrl)
          : Promise.resolve(null),
        values.motherPhoto
          ? uploadFileToStorage(values.motherPhoto, generateUrl)
          : Promise.resolve(null),
      ]);

      const classStartDate = new Date(values.classStartDate).getTime();

      // Create student record
      const studentId = await createStudent({
        studentNumber: values.studentNumber,
        studentFullName: values.studentFullName,
        gender: values.gender,
        dateOfBirth: new Date(values.dateOfBirth).getTime(),
        placeOfBirth: values.placeOfBirth,
        citizenship: values.citizenship,
        religion: values.religion,
        bloodGroup: values.bloodGroup,
        birthCertificateNumber: values.birthCertificateNumber,
        passportNumber: values.passportNumber || undefined,
        passportValidTill: values.passportValidTill
          ? new Date(values.passportValidTill).getTime()
          : undefined,
        standardLevel: values.standardLevel as Id<"standardLevels">,
        academicYear: values.academicYear as Id<"academicYears">,
        campus: values.campus as Id<"campuses">,
        classStartDate,
        presentAddress: values.presentAddress,
        permanentAddress: values.permanentAddress || undefined,
        previousSchoolName: values.previousSchoolName || undefined,
        previousSchoolAddress: values.previousSchoolAddress || undefined,
        healthIssue: {
          hasHealthIssues: values.hasHealthIssues,
          issueDescription: values.healthIssueDescription || undefined,
        },
        studentPhotoUrl: studentPhotoId ?? undefined,
        fatherPhotoUrl: fatherPhotoId ?? undefined,
        motherPhotoUrl: motherPhotoId ?? undefined,
        fatherName: values.fatherName,
        fatherOccupation: values.fatherOccupation,
        fatherNidNumber: values.fatherNidNumber,
        fatherPhoneNumber: values.fatherPhoneNumber,
        motherName: values.motherName,
        motherOccupation: values.motherOccupation,
        motherNidNumber: values.motherNidNumber,
        motherPhoneNumber: values.motherPhoneNumber,
        guardianName: values.guardianName,
        guardianRelation: values.guardianRelation,
        guardianNidNumber: values.guardianNidNumber,
        guardianPhoneNumber: values.guardianPhoneNumber,
        familyAnnualIncome: values.familyAnnualIncome,
        consultantName: values.consultantName,
      });

      // Create enrollment record
      await createEnrollment({
        studentId,
        academicYear: values.academicYear as Id<"academicYears">,
        standardLevelId: values.standardLevel as Id<"standardLevels">,
        campus: values.campus,
        enrollmentType: "new_admission",
        enrollmentDate: Date.now(),
      });

      // Create student fee records for each applicable fee type
      const feeTypes = ["admission", "tuition", "registration"] as const;
      for (const feeType of feeTypes) {
        const amount = values[`${feeType}Fee` as keyof typeof values] as
          | number
          | null
          | undefined;
        if (!amount || amount <= 0) continue;

        const structure = feeStructures?.find(
          (f) =>
            f.standardLevel === values.standardLevel && f.feeType === feeType,
        );
        if (structure) {
          await createStudentFee({
            studentId,
            feeStructureId: structure._id,
            academicYear: values.academicYear as Id<"academicYears">,
            originalAmount: structure.baseAmount,
            paidAmount: 0,
            balance: structure.baseAmount,
            status: "unpaid",
          });
        }
      }

      toast.success("Student admitted successfully");
      onSuccess();
    } catch (err) {
      toast.error("Failed to admit student. Please try again.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submitAdmission, isSubmitting };
}
