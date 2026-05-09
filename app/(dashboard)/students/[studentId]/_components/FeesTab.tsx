"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import { DollarSign, MoreHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import { CollectFeesDialog } from "./CollectFeesDialog";
import { FeeDetailDialog } from "./FeeDetailDialog";

interface FeesTabProps {
  studentId: Id<"students">;
}

const statusStyles: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  partial: "bg-yellow-100 text-yellow-700 border-yellow-200",
  unpaid: "bg-red-100 text-red-700 border-red-200",
};

export function FeesTab({ studentId }: FeesTabProps) {
  const [selectedFeeIds, setSelectedFeeIds] = useState<Set<string>>(new Set());
  const [collectDialogOpen, setCollectDialogOpen] = useState(false);
  const [detailFeeId, setDetailFeeId] = useState<Id<"studentFees"> | null>(
    null,
  );

  const fees = useQuery(api.studentFees.getByStudent, { studentId });

  const unpaidFees = useMemo(
    () => (fees ?? []).filter((f) => f.status !== "paid"),
    [fees],
  );

  const selectedFeesForDialog = useMemo(
    () => (fees ?? []).filter((f) => selectedFeeIds.has(f._id as string)),
    [fees, selectedFeeIds],
  );

  const selectedTotal = useMemo(
    () => selectedFeesForDialog.reduce((sum, f) => sum + f.balance, 0),
    [selectedFeesForDialog],
  );

  const allUnpaidSelected =
    unpaidFees.length > 0 &&
    unpaidFees.every((f) => selectedFeeIds.has(f._id as string));

  const someSelected = selectedFeeIds.size > 0;

  const toggleFee = useCallback((feeId: string) => {
    setSelectedFeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(feeId)) {
        next.delete(feeId);
      } else {
        next.add(feeId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allUnpaidSelected) {
      setSelectedFeeIds(new Set());
    } else {
      setSelectedFeeIds(new Set(unpaidFees.map((f) => f._id as string)));
    }
  }, [allUnpaidSelected, unpaidFees]);

  const openCollectForSingle = useCallback((feeId: Id<"studentFees">) => {
    setSelectedFeeIds(new Set([feeId as string]));
    setCollectDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setCollectDialogOpen(false);
    setSelectedFeeIds(new Set());
  }, []);

  if (fees === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (fees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <DollarSign className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">No fee records</p>
        <p className="text-sm text-gray-400 mt-1">
          Fee records are created automatically during admission.
        </p>
      </div>
    );
  }

  const totalFees = fees.reduce((s, f) => s + f.originalAmount, 0);
  const totalPaid = fees.reduce((s, f) => s + f.paidAmount, 0);
  const totalBalance = fees.reduce((s, f) => s + f.balance, 0);

  const detailFee = fees.find((f) => f._id === detailFeeId);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Fees", value: totalFees, color: "text-gray-900" },
          { label: "Total Paid", value: totalPaid, color: "text-green-700" },
          {
            label: "Outstanding",
            value: totalBalance,
            color: totalBalance > 0 ? "text-red-600" : "text-green-700",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3 border">
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className={`text-lg font-bold mt-0.5 ${color}`}>
              {value.toLocaleString("en-US", {
                style: "currency",
                currency: "BDT",
                minimumFractionDigits: 0,
              })}
            </p>
          </div>
        ))}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center justify-between bg-school-green/5 border border-school-green/20 rounded-lg px-4 py-2.5">
          <span className="text-sm text-gray-700">
            <span className="font-medium">{selectedFeeIds.size}</span> fee(s)
            selected &middot; Total:{" "}
            <span className="font-bold text-school-green">
              ৳{selectedTotal.toLocaleString()}
            </span>
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFeeIds(new Set())}
              aria-label="Clear selection"
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => setCollectDialogOpen(true)}
              className="bg-school-green hover:bg-school-green/90 text-white"
              aria-label="Collect selected fees"
            >
              Collect Fees
            </Button>
          </div>
        </div>
      )}

      {/* Fees table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-10">
                <Checkbox
                  checked={allUnpaidSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all unpaid fees"
                  disabled={unpaidFees.length === 0}
                />
              </TableHead>
              <TableHead>Fee Type</TableHead>
              <TableHead>Academic Year</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.map((fee) => {
              const isSelectable = fee.status !== "paid";
              const isSelected = selectedFeeIds.has(fee._id as string);
              return (
                <TableRow
                  key={fee._id}
                  className={cn(
                    "cursor-pointer hover:bg-gray-50 transition-colors",
                    fee.status === "unpaid" && "bg-red-50/50",
                    isSelected && "bg-school-green/5",
                  )}
                  onClick={() => setDetailFeeId(fee._id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isSelectable && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleFee(fee._id as string)}
                        aria-label={`Select ${fee.feeStructureDoc?.feeType ?? "fee"} for collection`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium capitalize">
                    {fee.feeStructureDoc?.feeType ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {fee.academicYearDoc?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {fee.billingPeriod ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    ৳{fee.originalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm text-green-700">
                    ৳{fee.paidAmount.toLocaleString()}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right text-sm font-medium",
                      fee.balance > 0 && "text-red-600",
                    )}
                  >
                    ৳{fee.balance.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusStyles[fee.status]}
                    >
                      {fee.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {format(new Date(fee.dueDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {fee.status !== "paid" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Actions for ${fee.feeStructureDoc?.feeType ?? "fee"}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              openCollectForSingle(fee._id);
                            }}
                          >
                            Collect Fee
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Collect Fees dialog (multi-fee or single-fee) */}
      {collectDialogOpen && selectedFeesForDialog.length > 0 && (
        <CollectFeesDialog
          open={collectDialogOpen}
          onClose={handleDialogClose}
          initialFees={selectedFeesForDialog}
          studentId={studentId}
          allFees={fees}
        />
      )}

      {/* Fee Detail dialog */}
      {detailFee && (
        <FeeDetailDialog
          open={!!detailFeeId}
          onClose={() => setDetailFeeId(null)}
          fee={detailFee}
          studentId={studentId}
          onCollectFee={() => {
            setDetailFeeId(null);
            openCollectForSingle(detailFee._id);
          }}
        />
      )}
    </div>
  );
}
