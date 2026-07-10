"use client";

import { useQuery } from "convex/react";
import { Receipt as ReceiptIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { RoleGate } from "@/components/shared/RoleGate";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useReceiptsFilters } from "@/hooks/use-receipts-filters";
import { ReceiptsFilters } from "./_components/ReceiptsFilters";
import { columns } from "./columns";

export default function ReceiptsPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <ReceiptsPageContent />
    </RoleGate>
  );
}

function ReceiptsPageContent() {
  const router = useRouter();
  const filters = useReceiptsFilters();
  const receipts = useQuery(api.receipts.listReceipts, filters.queryArgs);

  return (
    <div className="flex flex-col gap-5 pb-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
        <p className="text-sm text-gray-500">
          Browse, filter, and open Money Receipts issued by the school.
        </p>
      </header>

      <ReceiptsFilters
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        studentId={filters.studentId}
        studentLabel={filters.studentLabel}
        status={filters.status}
        onDateFromChange={filters.setDateFrom}
        onDateToChange={filters.setDateTo}
        onStudentSelect={filters.onStudentSelect}
        onStatusChange={filters.setStatus}
        onReset={filters.reset}
      />

      {receipts === undefined ? (
        <ReceiptsTableSkeleton />
      ) : receipts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <DataTable
            columns={columns}
            data={receipts}
            searchPlaceholder="Search receipt #, student, payer..."
            onRowClick={(row) => router.push(`/receipts/${row._id}`)}
          />
        </div>
      )}
    </div>
  );
}

function ReceiptsTableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center rounded-lg border bg-white py-16 text-center">
      <ReceiptIcon className="h-12 w-12 text-muted-foreground/50" aria-hidden />
      <h2 className="mt-4 text-lg font-semibold text-gray-900">
        No receipts in this range
      </h2>
      <p className="mt-1 max-w-md text-sm text-gray-500">
        Adjust the date range, clear the student filter, or collect a payment
        from a student detail page to issue your first Money Receipt.
      </p>
    </div>
  );
}
