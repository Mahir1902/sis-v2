"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getAvailableMonths } from "@/lib/feeCollectionUtils";
import { formatBillingPeriod } from "@/lib/formatBillingPeriod";

interface AssignFeeDialogProps {
  open: boolean;
  onClose: () => void;
  studentId: Id<"students">;
  academicYearId: Id<"academicYears">;
  academicYearStartDate: number;
  academicYearEndDate: number;
  existingFees: Array<{
    feeStructureId: Id<"feeStructure">;
    billingPeriod?: string;
  }>;
}

/**
 * Dialog for assigning a new fee structure to a student mid-semester.
 *
 * Populated by the getAssignableStructures query. Monthly structures show
 * a billing month picker; one-time/yearly structures submit immediately.
 */
export function AssignFeeDialog({
  open,
  onClose,
  studentId,
  academicYearId,
  academicYearStartDate,
  academicYearEndDate,
  existingFees,
}: AssignFeeDialogProps) {
  const [selectedStructureId, setSelectedStructureId] = useState<string>("");
  const [selectedBillingPeriod, setSelectedBillingPeriod] =
    useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const structures = useQuery(api.assignFee.getAssignableStructures, {
    studentId,
    academicYearId,
  });

  const createStudentFee = useMutation(api.studentFees.createStudentFee);

  const selectedStructure = useMemo(
    () => structures?.find((s) => s._id === selectedStructureId),
    [structures, selectedStructureId],
  );

  const isMonthly = selectedStructure?.frequency === "monthly";

  // Get available months for the selected monthly structure
  const availableMonths = useMemo(() => {
    if (!isMonthly || !selectedStructure) return [];

    const existingPeriodsForStructure = existingFees
      .filter((f) => f.feeStructureId === selectedStructure._id)
      .map((f) => f.billingPeriod)
      .filter((p): p is string => !!p);

    return getAvailableMonths(
      academicYearStartDate,
      academicYearEndDate,
      existingPeriodsForStructure,
    );
  }, [
    isMonthly,
    selectedStructure,
    existingFees,
    academicYearStartDate,
    academicYearEndDate,
  ]);

  const canSubmit =
    selectedStructure &&
    !isSubmitting &&
    (!isMonthly || selectedBillingPeriod.length > 0);

  const handleStructureChange = useCallback((value: string) => {
    setSelectedStructureId(value);
    setSelectedBillingPeriod("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedStructure || !canSubmit) return;

    setIsSubmitting(true);
    try {
      await createStudentFee({
        studentId,
        feeStructureId: selectedStructure._id as Id<"feeStructure">,
        academicYear: academicYearId,
        originalAmount: selectedStructure.baseAmount,
        paidAmount: 0,
        balance: selectedStructure.baseAmount,
        status: "unpaid",
        billingPeriod: isMonthly ? selectedBillingPeriod : undefined,
      });
      toast.success("Fee assigned successfully");
      onClose();
    } catch {
      toast.error("Failed to assign fee. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedStructure,
    canSubmit,
    createStudentFee,
    studentId,
    academicYearId,
    isMonthly,
    selectedBillingPeriod,
    onClose,
  ]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onClose();
    },
    [onClose],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Fee</DialogTitle>
          <DialogDescription>
            Add a fee structure to this student for the current academic year.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Fee Structure Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="fee-structure">Fee Structure</Label>
            {structures === undefined ? (
              <Skeleton className="h-10 w-full" />
            ) : structures.length === 0 ? (
              <p className="text-sm text-gray-500">
                No assignable fee structures available for this student&apos;s
                level.
              </p>
            ) : (
              <Select
                value={selectedStructureId}
                onValueChange={handleStructureChange}
              >
                <SelectTrigger
                  id="fee-structure"
                  aria-label="Select fee structure"
                >
                  <SelectValue placeholder="Select a fee structure" />
                </SelectTrigger>
                <SelectContent>
                  {structures.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      <span className="capitalize">{s.name}</span>
                      <span className="text-gray-400 ml-2">
                        ৳{s.baseAmount.toLocaleString()} &middot; {s.frequency}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Billing Month Picker — only for monthly */}
          {isMonthly && (
            <div className="space-y-2">
              <Label htmlFor="billing-month">Billing Month</Label>
              {availableMonths.length === 0 ? (
                <p className="text-sm text-gray-500">
                  All months for this fee structure are already assigned.
                </p>
              ) : (
                <Select
                  value={selectedBillingPeriod}
                  onValueChange={setSelectedBillingPeriod}
                >
                  <SelectTrigger
                    id="billing-month"
                    aria-label="Select billing month"
                  >
                    <SelectValue placeholder="Select a month" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((period) => (
                      <SelectItem key={period} value={period}>
                        {formatBillingPeriod(period)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Fee amount preview */}
          {selectedStructure && (
            <div className="bg-gray-50 rounded-lg p-3 border">
              <p className="text-xs text-gray-500 font-medium">Amount</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">
                ৳{selectedStructure.baseAmount.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Will be added as unpaid
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cancel fee assignment"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-school-green hover:bg-school-green/90 text-white"
            aria-label="Assign fee to student"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Fee"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
