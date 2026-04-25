"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { AddStudentButton } from "./_components/AddStudentButton";
import {
  type StudentsFilters,
  StudentsFilterToolbar,
} from "./_components/StudentsFilterToolbar";
import { columns, type StudentRow } from "./columns";

function StudentsTableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-64" />
      <div className="rounded-md border bg-white">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
            key={i}
            className="flex items-center gap-4 p-4 border-b last:border-0"
          >
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const [filters, setFilters] = useState<StudentsFilters>({
    standardLevel: new Set(),
    status: new Set(),
    gender: new Set(),
    academicYear: new Set(),
  });

  // Convert Sets to sorted arrays for stable Convex query args
  const queryArgs = useMemo(() => {
    const args: Record<string, string[]> = {};
    if (filters.standardLevel.size > 0)
      args.standardLevel = [...filters.standardLevel].sort();
    if (filters.status.size > 0) args.status = [...filters.status].sort();
    if (filters.gender.size > 0) args.gender = [...filters.gender].sort();
    if (filters.academicYear.size > 0)
      args.academicYear = [...filters.academicYear].sort();
    return args;
  }, [filters]);

  const students = useQuery(
    api.students.getAllStudents,
    isAuthenticated ? queryArgs : "skip",
  );

  const isLoading = students === undefined;

  const hasActiveFilters =
    filters.standardLevel.size > 0 ||
    filters.status.size > 0 ||
    filters.gender.size > 0 ||
    filters.academicYear.size > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading
              ? "Loading…"
              : `${students.length} student${students.length !== 1 ? "s" : ""}${hasActiveFilters ? " (filtered)" : ""}`}
          </p>
        </div>
        <AddStudentButton />
      </div>

      {/* Table */}
      {isLoading ? (
        <StudentsTableSkeleton />
      ) : students.length === 0 && !hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-gray-900">No students yet</p>
          <p className="text-sm text-gray-500 mt-1 mb-6">
            Add your first student to get started.
          </p>
          <AddStudentButton />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={students as unknown as StudentRow[]}
          searchPlaceholder="Search students…"
          onRowClick={(row) => router.push(`/students/${row._id}`)}
          toolbar={
            <StudentsFilterToolbar
              filters={filters}
              onFiltersChange={setFilters}
            />
          }
        />
      )}
    </div>
  );
}
