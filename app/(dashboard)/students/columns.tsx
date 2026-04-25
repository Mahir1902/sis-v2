"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Id } from "@/convex/_generated/dataModel";
import { StatusBadge } from "./_components/StatusBadge";

export type StudentRow = {
  _id: Id<"students">;
  studentNumber: string;
  studentFullName: string;
  studentPhotoUrl: string | null;
  academicYearName: string;
  standardLevelName: string;
  gender: "Male" | "Female";
  classStartDate: number;
  status:
    | "active"
    | "graduated"
    | "transferred"
    | "withdrawn"
    | "suspended"
    | "expelled";
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const columns: ColumnDef<StudentRow>[] = [
  {
    id: "studentInfo",
    header: "Student",
    accessorFn: (row) => `${row.studentFullName} ${row.studentNumber}`,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage
            src={row.original.studentPhotoUrl ?? undefined}
            alt={row.original.studentFullName}
          />
          <AvatarFallback className="bg-school-green/10 text-school-green font-semibold text-sm">
            {getInitials(row.original.studentFullName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-gray-900">
            {row.original.studentFullName}
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
      <span className="text-sm text-gray-700">{row.original.gender}</span>
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
