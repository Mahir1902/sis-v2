"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { InfoCard } from "@/components/InfoCard";
import { format } from "date-fns";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

interface OverviewTabProps {
  studentId: Id<"students">;
}

/** Mask a document number, showing only the last 4 characters. */
function maskSensitive(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 4) return "****";
  return "****" + value.slice(-4);
}

export function OverviewTab({ studentId }: OverviewTabProps) {
  const student = useQuery(api.students.getStudentById, { studentId });
  const me = useQuery(api.users.getMe);
  const currentEnrollment = useQuery(api.enrollments.getCurrentEnrollment, { studentId });
  const siblings = useQuery(api.students.getSiblingsByStudent, { studentId });
  const isAdmin = me?.role === "admin";

  if (student === undefined) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!student) return <p className="text-gray-500">Student not found.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* 1. Personal Information */}
      <InfoCard
        title="Personal Information"
        info={[
          { label: "Full Name", value: student.studentFullName },
          { label: "Gender", value: student.gender },
          {
            label: "Date of Birth",
            value: student.dateOfBirth
              ? format(new Date(student.dateOfBirth), "dd/MM/yyyy")
              : undefined,
          },
          { label: "Place of Birth", value: student.placeOfBirth },
          { label: "Citizenship", value: student.citizenship },
          { label: "Religion", value: student.religion },
          { label: "Blood Group", value: student.bloodGroup },
        ]}
      />

      {/* 2. Academic Information */}
      <InfoCard
        title="Academic Information"
        info={[
          { label: "Student Number", value: student.studentNumber },
          { label: "Standard Level", value: student.standardLevelDoc?.name },
          { label: "Academic Year", value: student.academicYearDoc?.name },
          { label: "Campus", value: student.campusDoc?.name },
          {
            label: "Admission Date",
            value: student.admissionDate
              ? format(new Date(student.admissionDate), "dd/MM/yyyy")
              : undefined,
          },
          {
            label: "Class Start",
            value: student.classStartDate
              ? format(new Date(student.classStartDate), "dd/MM/yyyy")
              : undefined,
          },
        ]}
      />

      {/* 3. Current Enrollment */}
      <InfoCard
        title="Current Enrollment"
        info={
          currentEnrollment
            ? [
                { label: "Level", value: currentEnrollment.standardLevelDoc?.name },
                { label: "Year", value: currentEnrollment.academicYearDoc?.name },
                { label: "Section", value: currentEnrollment.section },
                { label: "Roll No.", value: currentEnrollment.rollNumber },
                { label: "Campus", value: currentEnrollment.campus },
                { label: "Type", value: currentEnrollment.enrollmentType },
              ]
            : [{ label: "Status", value: "No active enrollment" }]
        }
      />

      {/* 4. Document Information */}
      <InfoCard
        title="Document Information"
        info={[
          { label: "Birth Cert No.", value: isAdmin ? student.birthCertificateNumber : maskSensitive(student.birthCertificateNumber) },
          { label: "Passport No.", value: isAdmin
            ? ("passportNumber" in student ? (student as { passportNumber?: string }).passportNumber : undefined)
            : maskSensitive("passportNumber" in student ? (student as { passportNumber?: string }).passportNumber : undefined) },
          {
            label: "Passport Expiry",
            value: "passportValidTill" in student && student.passportValidTill
              ? format(new Date(student.passportValidTill as number), "dd/MM/yyyy")
              : undefined,
          },
        ]}
      />

      {/* 5. Health Information */}
      <InfoCard
        title="Health Information"
        borderColor={
          student.healthIssue.hasHealthIssues
            ? "border-red-400"
            : "border-green-400"
        }
        info={[
          {
            label: "Has Health Issues",
            value: student.healthIssue.hasHealthIssues ? "Yes" : "No",
          },
          {
            label: "Description",
            value: student.healthIssue.issueDescription,
          },
        ]}
      />

      {/* 6. Previous Education (conditional) */}
      {student.previousSchoolName && (
        <InfoCard
          title="Previous Education"
          info={[
            { label: "School Name", value: student.previousSchoolName },
            { label: "School Address", value: student.previousSchoolAddress },
          ]}
        />
      )}

      {/* 7. Family Information — full width */}
      <div className="md:col-span-2 xl:col-span-3">
        <InfoCard title="Family Information">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Address</p>
              <p className="text-sm text-gray-700">{student.presentAddress}</p>
              {student.permanentAddress && (
                <p className="text-sm text-gray-500 mt-1">{student.permanentAddress}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Father</p>
              <div className="space-y-1 text-sm">
                <p>{student.fatherName}</p>
                <p className="text-gray-500">{student.fatherOccupation}</p>
                <p className="text-gray-500">{student.fatherPhoneNumber}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Mother</p>
              <div className="space-y-1 text-sm">
                <p>{student.motherName}</p>
                <p className="text-gray-500">{student.motherOccupation}</p>
                <p className="text-gray-500">{student.motherPhoneNumber}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Guardian</p>
            <div className="flex gap-6 text-sm">
              <p>{student.guardianName}</p>
              <p className="text-gray-500">({student.guardianRelation})</p>
              <p className="text-gray-500">{student.guardianPhoneNumber}</p>
            </div>
          </div>
        </InfoCard>
      </div>

      {/* 8. Siblings (conditional) */}
      {siblings && siblings.length > 0 && (
        <div className="md:col-span-2">
          <InfoCard title="Siblings">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {siblings.map((s) => s && (
                <Link
                  key={s._id}
                  href={`/students/${s._id}`}
                  className="p-3 rounded-lg border border-gray-200 hover:border-school-green hover:bg-green-50 transition-colors"
                >
                  <p className="font-medium text-sm text-gray-900">{s.studentFullName}</p>
                  <p className="text-xs text-gray-500">{s.studentNumber}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.standardLevelName} · {s.campusName}
                  </p>
                </Link>
              ))}
            </div>
          </InfoCard>
        </div>
      )}
    </div>
  );
}
