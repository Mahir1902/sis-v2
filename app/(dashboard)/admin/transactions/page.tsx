"use client";

import { useQuery } from "convex/react";
import { Receipt } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { RoleGate } from "@/components/shared/RoleGate";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTransactionFilters } from "@/hooks/use-transaction-filters";
import { ExportButton } from "./_components/ExportButton";
import { SessionDetailSheet } from "./_components/SessionDetailSheet";
import { SummaryCards } from "./_components/SummaryCards";
import { TransactionFilters } from "./_components/TransactionFilters";
import { columns, type SessionRow } from "./columns";

export default function TransactionLogPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <TransactionLogContent />
    </RoleGate>
  );
}

function TransactionLogContent() {
  const academicYears = useQuery(api.academicYears.list);
  const defaultYearId =
    academicYears && academicYears.length > 0
      ? academicYears[0]._id
      : undefined;

  const filters = useTransactionFilters(defaultYearId);
  const [selectedSession, setSelectedSession] =
    useState<Id<"feeCollectionSessions"> | null>(null);

  const data = useQuery(
    api.transactionLog.getTransactionLog,
    filters.queryArgs === "skip" ? "skip" : filters.queryArgs,
  );

  const sessions = data?.sessions;
  const aggregates = data?.aggregates;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-7 w-7 text-school-green" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Transaction Log
            </h1>
            <p className="text-sm text-muted-foreground">
              View and filter all fee collection sessions
            </p>
          </div>
        </div>
        <ExportButton
          queryArgs={filters.queryArgs === "skip" ? null : filters.queryArgs}
          yearName={
            academicYears?.find((y) => y._id === filters.effectiveYearId)
              ?.name ?? ""
          }
          levelName={data?.standardLevelName ?? undefined}
          dateRangeLabel={filters.dateRangeLabel || undefined}
          disabled={!sessions || sessions.length === 0}
        />
      </div>

      {/* Filter Bar */}
      {academicYears && academicYears.length > 0 && (
        <TransactionFilters
          academicYears={academicYears}
          effectiveYearId={filters.effectiveYearId}
          onYearChange={filters.setAcademicYearId}
          standardLevelId={filters.standardLevelId}
          onStandardLevelChange={filters.setStandardLevelId}
          dateRange={filters.dateRange}
          onDateRangeChange={filters.setDateRange}
          datePresetLabel={filters.datePresetLabel}
          onPresetSelect={(label, range) => {
            filters.setDatePresetLabel(label);
            filters.setDateRange(range);
          }}
          onDateClear={() => {
            filters.setDateRange({ from: undefined, to: undefined });
            filters.setDatePresetLabel(null);
          }}
          studentIds={filters.studentIds}
          onStudentIdsChange={filters.setStudentIds}
          campusFilter={filters.campusFilter}
          onCampusChange={filters.setCampusFilter}
          paymentMode={filters.paymentMode}
          onPaymentModeChange={(mode) =>
            filters.setPaymentMode(
              mode as
                | "Cash"
                | "Bank Transfer"
                | "Cheque"
                | "UPI"
                | "Online"
                | undefined,
            )
          }
          includeVoided={filters.includeVoided}
          onIncludeVoidedChange={filters.setIncludeVoided}
          hasActiveFilters={filters.hasActiveFilters}
          onReset={filters.resetAll}
        />
      )}

      {/* Summary Cards */}
      <SummaryCards aggregates={aggregates} />

      {/* Content: Skeleton → Empty → Table */}
      {data === undefined ? (
        <TransactionLogSkeleton />
      ) : sessions && sessions.length === 0 ? (
        <TransactionLogEmpty />
      ) : (
        <DataTable<SessionRow, unknown>
          columns={columns}
          data={(sessions ?? []) as unknown as SessionRow[]}
          searchPlaceholder="Search transactions..."
          pageSize={25}
          pageSizeOptions={[10, 25, 50]}
          onRowClick={(row) => setSelectedSession(row._id)}
        />
      )}

      {/* Session Detail Sheet */}
      <SessionDetailSheet
        sessionId={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  );
}

export function TransactionLogSkeleton() {
  return (
    <div className="rounded-lg border bg-white">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Campus</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Payment Mode</TableHead>
              <TableHead>Collected By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Fee Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }, (_, i) => `sk-${i}`).map((key) => (
              <TableRow key={key}>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-36" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-8" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TransactionLogEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-white py-16">
      <Receipt className="mx-auto h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold">
        No transactions recorded yet
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Fee collection sessions will appear here once payments are recorded.
      </p>
    </div>
  );
}
