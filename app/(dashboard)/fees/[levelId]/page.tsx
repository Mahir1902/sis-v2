"use client";

import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  DollarSign,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Receipt,
  Users,
} from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";
import { RoleGate } from "@/components/shared/RoleGate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useFeeLevelSummary } from "@/hooks/use-fee-level-summary";
import { CreateFeeDialog } from "../_components/CreateFeeDialog";
import { EditFeeDialog } from "../_components/EditFeeDialog";

// ── Fee type badge colors ─────────────────────────────────────────────────────

const feeTypeBadgeStyles: Record<string, string> = {
  admission: "bg-green-100 text-green-700",
  tuition: "bg-blue-100 text-blue-700",
  registration: "bg-yellow-100 text-yellow-700",
  library: "bg-purple-100 text-purple-700",
  sports: "bg-orange-100 text-orange-700",
  computer: "bg-cyan-100 text-cyan-700",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeeWithCount {
  _id: Id<"feeStructure">;
  _creationTime: number;
  name: string;
  feeType:
    | "admission"
    | "tuition"
    | "registration"
    | "library"
    | "sports"
    | "computer";
  baseAmount: number;
  frequency: "one-time" | "monthly" | "yearly";
  standardLevel: Id<"standardLevels">;
  isActive: boolean;
  dueDate?: number;
  lateFeeConfig?: {
    enabled: boolean;
    amount?: number;
    amountPerDay?: number;
    maxAmount?: number;
    maxDays?: number;
  };
  studentCount: number;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FeeDetailPage({
  params,
}: {
  params: Promise<{ levelId: string }>;
}) {
  const { levelId } = use(params);

  return (
    <RoleGate allowedRoles={["admin"]}>
      <FeeDetailContent levelId={levelId as Id<"standardLevels">} />
    </RoleGate>
  );
}

// ── Content ───────────────────────────────────────────────────────────────────

function FeeDetailContent({ levelId }: { levelId: Id<"standardLevels"> }) {
  const [editFee, setEditFee] = useState<FeeWithCount | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deactivateId, setDeactivateId] = useState<Id<"feeStructure"> | null>(
    null,
  );
  const [reactivateId, setReactivateId] = useState<Id<"feeStructure"> | null>(
    null,
  );
  const [isToggling, setIsToggling] = useState(false);

  const fees = useQuery(api.feeStructure.getByLevel, {
    standardLevel: levelId,
  });
  const levels = useQuery(api.standardLevels.list);
  const toggleActive = useMutation(api.feeStructure.toggleActive);

  const { level, summaryStats } = useFeeLevelSummary(fees, levels, levelId);

  // Find the fee being targeted for deactivate/reactivate
  const feeToDeactivate = fees?.find((f) => f._id === deactivateId);
  const feeToReactivate = fees?.find((f) => f._id === reactivateId);

  // ── Toggle handler ────────────────────────────────────────────────────────

  async function handleToggle(feeId: Id<"feeStructure">, isActive: boolean) {
    setIsToggling(true);
    try {
      await toggleActive({ feeId, isActive });
      toast.success(
        isActive ? "Fee structure reactivated" : "Fee structure deactivated",
      );
      setDeactivateId(null);
      setReactivateId(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update fee status";
      toast.error(message);
    } finally {
      setIsToggling(false);
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (fees === undefined || levels === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // ── Not found state ───────────────────────────────────────────────────────

  if (!level) {
    return (
      <div className="space-y-6">
        <Link
          href="/fees"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Back to fee structures"
        >
          <ArrowLeft className="h-4 w-4" />
          Fee Structures
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <Receipt className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Standard level not found</p>
          <p className="text-sm text-gray-400 mt-1">
            This standard level may have been removed.
          </p>
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (fees.length === 0) {
    return (
      <div className="space-y-6">
        {/* Back link */}
        <Link
          href="/fees"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Back to fee structures"
        >
          <ArrowLeft className="h-4 w-4" />
          Fee Structures
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {level.name} — Fee Structure
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage fee types assigned to this standard level
            </p>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border">
          <Receipt className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No fee types yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Add your first fee type to this standard level
          </p>
          <Button
            className="mt-4 bg-school-green hover:bg-school-green/90 text-white"
            onClick={() => setCreateDialogOpen(true)}
            aria-label="Add your first fee type"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Fee Type
          </Button>
        </div>

        <CreateFeeDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          standardLevelId={levelId}
        />
      </div>
    );
  }

  // ── Main content ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/fees"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Back to fee structures"
      >
        <ArrowLeft className="h-4 w-4" />
        Fee Structures
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {level.name} — Fee Structure
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage fee types assigned to this standard level
          </p>
        </div>
        <Button
          className="bg-school-green hover:bg-school-green/90 text-white"
          onClick={() => setCreateDialogOpen(true)}
          aria-label="Add a new fee type"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Fee Type
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Fees</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summaryStats.activeFees}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Annual Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  ৳{summaryStats.totalAnnualCost.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Students</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summaryStats.students}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fee table */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead className="text-right">Late Fee</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.map((fee) => (
              <TableRow
                key={fee._id}
                className={fee.isActive ? "" : "opacity-50"}
              >
                <TableCell className="font-medium">{fee.name}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      feeTypeBadgeStyles[fee.feeType] ??
                      "bg-gray-100 text-gray-700"
                    }
                  >
                    <span className="capitalize">{fee.feeType}</span>
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  ৳{fee.baseAmount.toLocaleString()}
                </TableCell>
                <TableCell className="capitalize">{fee.frequency}</TableCell>
                <TableCell className="text-right font-mono">
                  {fee.lateFeeConfig?.enabled && fee.lateFeeConfig?.amount
                    ? `৳${fee.lateFeeConfig.amount.toLocaleString()}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right">{fee.studentCount}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      fee.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }
                  >
                    {fee.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${fee.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setEditFee(fee)}
                        aria-label={`Edit ${fee.name}`}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {fee.isActive ? (
                        <DropdownMenuItem
                          onClick={() => setDeactivateId(fee._id)}
                          className="text-red-600 focus:text-red-600"
                          aria-label={`Deactivate ${fee.name}`}
                        >
                          <PowerOff className="h-4 w-4 mr-2" />
                          Deactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => setReactivateId(fee._id)}
                          className="text-green-600 focus:text-green-600"
                          aria-label={`Reactivate ${fee.name}`}
                        >
                          <Power className="h-4 w-4 mr-2" />
                          Reactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Fee Dialog */}
      <CreateFeeDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        standardLevelId={levelId}
      />

      {/* Edit Fee Dialog */}
      {editFee && (
        <EditFeeDialog
          key={editFee._id}
          open={!!editFee}
          onClose={() => setEditFee(null)}
          fee={{
            _id: editFee._id,
            name: editFee.name,
            feeType: editFee.feeType,
            baseAmount: editFee.baseAmount,
            frequency: editFee.frequency,
            dueDate: editFee.dueDate,
            lateFeeConfig: editFee.lateFeeConfig,
          }}
        />
      )}

      {/* Deactivate Confirmation */}
      <AlertDialog
        open={!!deactivateId}
        onOpenChange={() => setDeactivateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Fee Structure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate{" "}
              <strong>{feeToDeactivate?.name ?? "this fee"}</strong>. Existing
              student fees will be preserved but this fee will not be assigned
              to new students.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isToggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isToggling}
              onClick={async (e) => {
                e.preventDefault();
                if (deactivateId) {
                  await handleToggle(deactivateId, false);
                }
              }}
            >
              {isToggling ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate Confirmation */}
      <AlertDialog
        open={!!reactivateId}
        onOpenChange={() => setReactivateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate Fee Structure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reactivate{" "}
              <strong>{feeToReactivate?.name ?? "this fee"}</strong>. It will
              become available for assignment to new students again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isToggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isToggling}
              onClick={async (e) => {
                e.preventDefault();
                if (reactivateId) {
                  await handleToggle(reactivateId, true);
                }
              }}
            >
              {isToggling ? "Reactivating..." : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
