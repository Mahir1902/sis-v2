"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import { ClipboardList } from "lucide-react";
import { RoleGate } from "@/components/shared/RoleGate";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { Doc } from "@/convex/_generated/dataModel";
import { useAuditLogFilters } from "@/hooks/use-audit-log-filters";

// ── Constants ────────────────────────────────────────────────────────────────

type AuditAction = Doc<"auditLogs">["action"];

const ACTION_OPTIONS: { value: AuditAction; label: string }[] = [
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "status_change", label: "Status Change" },
  { value: "collect_payment", label: "Collect Payment" },
  { value: "apply_discount", label: "Apply Discount" },
  { value: "upload", label: "Upload" },
  { value: "promote", label: "Promote" },
  { value: "role_change", label: "Role Change" },
];

const ACTION_BADGE_STYLES: Record<AuditAction, string> = {
  create: "bg-green-400/40 text-green-700",
  update: "bg-blue-400/40 text-blue-700",
  delete: "bg-red-400/40 text-red-700",
  status_change: "bg-yellow-400/40 text-yellow-700",
  collect_payment: "bg-green-400/40 text-green-700",
  apply_discount: "bg-purple-400/40 text-purple-700",
  upload: "bg-blue-400/40 text-blue-700",
  promote: "bg-purple-400/40 text-purple-700",
  role_change: "bg-orange-400/40 text-orange-700",
};

function formatActionLabel(action: AuditAction): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <AuditLogPageContent />
    </RoleGate>
  );
}

// ── Content ──────────────────────────────────────────────────────────────────

function AuditLogPageContent() {
  const logs = useQuery(api.auditLogs.getRecentLogs, { limit: 200 });
  const {
    filteredLogs,
    actionFilter,
    setActionFilter,
    entityTypeFilter,
    setEntityTypeFilter,
    entityTypeOptions,
    allFilterValue,
  } = useAuditLogFilters(logs);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-school-green" />
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1 ml-9">
          Track all system activity
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="action-filter"
            >
              Action Type
            </label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger
                id="action-filter"
                aria-label="Filter by action type"
              >
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allFilterValue}>All Actions</SelectItem>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="entity-filter"
            >
              Entity Type
            </label>
            <Select
              value={entityTypeFilter}
              onValueChange={setEntityTypeFilter}
            >
              <SelectTrigger
                id="entity-filter"
                aria-label="Filter by entity type"
              >
                <SelectValue placeholder="All entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allFilterValue}>All Entities</SelectItem>
                {entityTypeOptions.map((entityType) => (
                  <SelectItem key={entityType} value={entityType}>
                    {entityType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      {logs === undefined ? (
        <AuditLogSkeleton />
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <ClipboardList className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No activity recorded yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Actions will appear here as users interact with the system
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <ClipboardList className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            No logs match the selected filters
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Try adjusting your filters to see more results
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="min-w-[160px]">Timestamp</TableHead>
                  <TableHead className="min-w-[120px]">User</TableHead>
                  <TableHead className="min-w-[120px]">Action</TableHead>
                  <TableHead className="min-w-[120px]">Entity Type</TableHead>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                      {format(
                        new Date(log.timestamp),
                        "MMM dd, yyyy 'at' h:mm a",
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-gray-900">
                      {log.userName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          ACTION_BADGE_STYLES[log.action] ??
                          "bg-gray-400/40 text-gray-700"
                        }
                      >
                        {formatActionLabel(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {log.entityType}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {log.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Result count */}
          <div className="border-t px-4 py-2">
            <p className="text-xs text-gray-500">
              Showing {filteredLogs.length} of {logs.length} entries
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function AuditLogSkeleton() {
  return (
    <div className="bg-white rounded-lg border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="min-w-[160px]">Timestamp</TableHead>
              <TableHead className="min-w-[120px]">User</TableHead>
              <TableHead className="min-w-[120px]">Action</TableHead>
              <TableHead className="min-w-[120px]">Entity Type</TableHead>
              <TableHead className="min-w-[200px]">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }, (_, i) => `sk-${i}`).map((key) => (
              <TableRow key={key}>
                <TableCell>
                  <Skeleton className="h-4 w-36" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
