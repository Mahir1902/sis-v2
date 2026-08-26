"use client";

import { useMutation } from "convex/react";
import { Phone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { StatusBadge } from "../../_components/StatusBadge";
import { EditStudentDialog } from "./EditStudentDialog";

type Status =
  | "active"
  | "graduated"
  | "transferred"
  | "withdrawn"
  | "suspended"
  | "expelled";

// Every field below `studentNumber` is optional because the `students` table
// was widened for the Excel import (#93) — a sheet with no column for a field
// leaves it unset. Each render site degrades to an em-dash, a muted
// "not recorded" label, or an omitted element; nothing is defaulted.
interface StudentHeaderProps {
  studentId: Id<"students">;
  student: {
    studentFullName?: string;
    studentNumber: string;
    status?: Status;
    studentPhotoUrl?: string | null;
    fatherName?: string;
    fatherPhoneNumber?: string;
    motherName?: string;
    motherPhoneNumber?: string;
    guardianName?: string;
    guardianPhoneNumber?: string;
    standardLevelDoc?: { name: string } | null;
    academicYearDoc?: { name: string } | null;
    campusDoc?: { name: string } | null;
  };
  currentEnrollment?: {
    section?: string;
  } | null;
}

function getInitials(name: string | undefined) {
  if (!name) return "—";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * One "call this parent" chip. Renders nothing when no phone number is on
 * record — a `tel:` link to an absent number is worse than no link at all.
 */
function ContactChip({
  label,
  relation,
  name,
  phone,
}: {
  label: string;
  relation: string;
  name: string | undefined;
  phone: string | undefined;
}) {
  if (!phone) return null;
  return (
    <a
      href={`tel:${phone}`}
      className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-green-100 transition-colors"
      aria-label={name ? `Call ${relation} ${name}` : `Call ${relation}`}
    >
      <Phone className="h-3 w-3" />
      {label}
    </a>
  );
}

export function StudentHeader({
  studentId,
  student,
  currentEnrollment,
}: StudentHeaderProps) {
  const router = useRouter();
  const deleteStudent = useMutation(api.students.deleteStudent);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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
                alt={student.studentFullName ?? student.studentNumber}
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
                {student.studentFullName ?? (
                  <span className="italic font-medium text-gray-400">
                    Name not recorded
                  </span>
                )}
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
          <ContactChip
            label="Father"
            relation="father"
            name={student.fatherName}
            phone={student.fatherPhoneNumber}
          />
          <ContactChip
            label="Mother"
            relation="mother"
            name={student.motherName}
            phone={student.motherPhoneNumber}
          />
          <ContactChip
            label="Guardian"
            relation="guardian"
            name={student.guardianName}
            phone={student.guardianPhoneNumber}
          />

          <div className="w-px h-5 bg-gray-200 mx-1 hidden md:block" />

          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => setEditOpen(true)}
            aria-label="Edit student"
          >
            Edit
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50"
                aria-label="Delete student"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Student</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete{" "}
                  {student.studentFullName ??
                    `student ${student.studentNumber}`}{" "}
                  and all associated records (enrollments, fees, grades, report
                  cards). This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await deleteStudent({ studentId });
                      toast.success("Student deleted successfully");
                      router.push("/students");
                    } catch {
                      toast.error("Failed to delete student");
                      setIsDeleting(false);
                    }
                  }}
                >
                  {isDeleting ? "Deleting\u2026" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <EditStudentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        studentId={studentId}
      />
    </div>
  );
}
