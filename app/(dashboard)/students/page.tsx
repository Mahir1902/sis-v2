"use client";

import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { DataTable } from "@/components/DataTable";
import { columns, StudentRow } from "./columns";
import { AddStudentButton } from "./_components/AddStudentButton";
import { Skeleton } from "@/components/ui/skeleton";

function StudentsTableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-64" />
      <div className="rounded-md border bg-white">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
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
  const { results, status, loadMore } = usePaginatedQuery(
    api.students.getAllStudents,
    isAuthenticated ? {} : "skip",
    { initialNumItems: 20 }
  );

  const isLoading = status === "LoadingFirstPage";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading ? "Loading…" : `${results.length} student${results.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <AddStudentButton />
      </div>

      {/* Table */}
      {isLoading ? (
        <StudentsTableSkeleton />
      ) : results.length === 0 ? (
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
          data={results as StudentRow[]}
          searchPlaceholder="Search students…"
          onRowClick={(row) => router.push(`/students/${row._id}`)}
        />
      )}

      {/* Load more */}
      {status === "CanLoadMore" && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => loadMore(20)}
            className="text-sm text-school-green hover:underline"
          >
            Load more students
          </button>
        </div>
      )}
    </div>
  );
}
