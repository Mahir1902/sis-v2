"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { FunctionReturnType } from "convex/server";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { api } from "@/convex/_generated/api";
import { getStudentInitials, studentSearchText } from "@/lib/studentRowDisplay";
import { StatusBadge } from "./_components/StatusBadge";

/** Derived from the query so the table can't drift from what the server sends. */
type StudentRow = FunctionReturnType<
  typeof api.students.getAllStudents
>[number];

export const columns: ColumnDef<StudentRow>[] = [
  {
    id: "studentInfo",
    header: "Student",
    accessorFn: studentSearchText,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage
            src={row.original.studentPhotoUrl ?? undefined}
            alt={row.original.studentFullName ?? "Student photo"}
          />
          <AvatarFallback className="bg-school-green/10 text-school-green font-semibold text-sm">
            {getStudentInitials(row.original.studentFullName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-gray-900">
            {row.original.studentFullName ?? (
              <span className="italic font-medium text-gray-400">
                Name not recorded
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">{row.original.studentNumber}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "academicYearName",
    header: "Academic Year",
    cell: ({ row }) => (
      <span className="text-sm text-gray-700">
        {row.original.academicYearName}
      </span>
    ),
  },
  {
    accessorKey: "standardLevelName",
    header: "Standard Level",
    cell: ({ row }) => (
      <span className="text-sm text-gray-700">
        {row.original.standardLevelName}
      </span>
    ),
  },
  {
    accessorKey: "gender",
    header: "Gender",
    cell: ({ row }) => (
      <span className="text-sm text-gray-700">
        {row.original.gender ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "classStartDate",
    header: "Class Start Date",
    cell: ({ row }) => (
      <span className="text-sm text-gray-700">
        {row.original.classStartDate
          ? format(new Date(row.original.classStartDate), "dd/MM/yyyy")
          : "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge studentId={row.original._id} status={row.original.status} />
    ),
  },
];
