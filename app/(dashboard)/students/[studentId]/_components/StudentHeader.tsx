"use client";

import { Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { StatusBadge } from "../../_components/StatusBadge";

type Status =
  | "active"
  | "graduated"
  | "transferred"
  | "withdrawn"
  | "suspended"
  | "expelled";

interface StudentHeaderProps {
  studentId: Id<"students">;
  student: {
    studentFullName: string;
    studentNumber: string;
    status: Status;
    studentPhotoUrl?: string | null;
    fatherName: string;
    fatherPhoneNumber: string;
    motherName: string;
    motherPhoneNumber: string;
    guardianName: string;
    guardianPhoneNumber: string;
    standardLevelDoc?: { name: string } | null;
    academicYearDoc?: { name: string } | null;
    campusDoc?: { name: string } | null;
  };
  currentEnrollment?: {
    section?: string;
  } | null;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function StudentHeader({
  studentId,
  student,
  currentEnrollment,
}: StudentHeaderProps) {
  const router = useRouter();

  const levelWithSection = [
    student.standardLevelDoc?.name,
    currentEnrollment?.section ? `Sec ${currentEnrollment.section}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="bg-white rounded-lg border p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Avatar + Info */}
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12 rounded-xl shadow-md">
              <AvatarImage
                src={
                  typeof student.studentPhotoUrl === "string"
                    ? student.studentPhotoUrl
                    : undefined
                }
                alt={student.studentFullName}
              />
              <AvatarFallback className="rounded-xl bg-gradient-to-br from-school-green to-school-green/80 text-white text-base font-bold">
                {getInitials(student.studentFullName)}
              </AvatarFallback>
            </Avatar>
            {student.status === "active" && (
              <span
                role="img"
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-white"
                aria-label="Active status"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900 truncate">
                {student.studentFullName}
              </h1>
              <StatusBadge studentId={studentId} status={student.status} />
            </div>

            {/* Color-coded chips */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <span className="bg-slate-100 text-slate-600 rounded-md px-2.5 py-0.5 text-xs font-medium">
                {student.studentNumber}
              </span>
              {levelWithSection && (
                <span className="bg-green-50 text-green-700 rounded-md px-2.5 py-0.5 text-xs font-medium">
                  {levelWithSection}
                </span>
              )}
              {student.campusDoc?.name && (
                <span className="bg-blue-50 text-blue-700 rounded-md px-2.5 py-0.5 text-xs font-medium">
                  {student.campusDoc.name}
                </span>
              )}
              {student.academicYearDoc?.name && (
                <span className="bg-purple-50 text-purple-700 rounded-md px-2.5 py-0.5 text-xs font-medium">
                  {student.academicYearDoc.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick contacts + Edit */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <a
            href={`tel:${student.fatherPhoneNumber}`}
            className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-green-100 transition-colors"
            aria-label={`Call father ${student.fatherName}`}
          >
            <Phone className="h-3 w-3" />
            Father
          </a>
          <a
            href={`tel:${student.motherPhoneNumber}`}
            className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-green-100 transition-colors"
            aria-label={`Call mother ${student.motherName}`}
          >
            <Phone className="h-3 w-3" />
            Mother
          </a>
          <a
            href={`tel:${student.guardianPhoneNumber}`}
            className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-green-100 transition-colors"
            aria-label={`Call guardian ${student.guardianName}`}
          >
            <Phone className="h-3 w-3" />
            Guardian
          </a>

          <div className="w-px h-5 bg-gray-200 mx-1 hidden md:block" />

          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => router.push(`/students/${studentId}/edit`)}
            aria-label="Edit student"
          >
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}
