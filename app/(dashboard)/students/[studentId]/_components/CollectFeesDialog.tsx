"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getSequentialRemovalIds } from "@/lib/feeCollectionUtils";
import { formatBillingPeriod } from "@/lib/formatBillingPeriod";
import { groupMonthlyStructures } from "@/lib/perStructureFutureMonths";

interface EnrichedDiscount {
  discountId: Id<"discountRules">;
  type: string;
  amount: number;
  ruleName: string;
  ruleValue?: number;
}

interface FeeForCollection {
  _id: Id<"studentFees">;
  feeStructureId: Id<"feeStructure">;
  originalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  academicYear: Id<"academicYears">;
  billingPeriod?: string;
  feeStructureDoc?: {
    feeType?: string;
    name?: string;
    frequency?: string;
  } | null;
  academicYearDoc?: { name?: string } | null;
  enrichedDiscounts: EnrichedDiscount[];
}

interface CollectFeesDialogProps {
  open: boolean;
  onClose: () => void;
  initialFees: FeeForCollection[];
  studentId: Id<"students">;
  allFees: FeeForCollection[];
}

const PAYMENT_MODES = [
  "Cash",
  "Bank Transfer",
  "Cheque",
  "UPI",
  "Online",
] as const;

export function CollectFeesDialog({
  open,
  onClose,
  initialFees,
  studentId,
  allFees,
}: CollectFeesDialogProps) {
  const [selectedFeeIds, setSelectedFeeIds] = useState<Set<string>>(
    () => new Set(initialFees.map((f) => f._id as string)),
  );
  const [paymentMode, setPaymentMode] =
    useState<(typeof PAYMENT_MODES)[number]>("Cash");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedStructures, setExpandedStructures] = useState<Set<string>>(
    new Set(),
  );

  const collectFees = useMutation(api.feeCollectionSessions.collectFees);
  const createFutureMonthFees = useMutation(
    api.feeCollectionSessions.createFutureMonthFees,
  );

  const selectedFees = useMemo(
    () => allFees.filter((f) => selectedFeeIds.has(f._id as string)),
    [allFees, selectedFeeIds],
  );

  const grandTotal = useMemo(
    () => selectedFees.reduce((sum, f) => sum + f.balance, 0),
    [selectedFees],
  );

  const feesForRemoval = useMemo(
    () =>
      allFees.map((f) => ({
        id: f._id as string,
        billingPeriod: f.billingPeriod,
        feeStructureId: f.feeStructureId as string,
      })),
    [allFees],
  );

  // Group selected monthly fees by structure for per-structure future month sections
  const monthlyGroups = useMemo(
    () =>
      groupMonthlyStructures(
        selectedFees.map((f) => ({
          _id: f._id as string,
          feeStructureId: f.feeStructureId as string,
          billingPeriod: f.billingPeriod,
          balance: f.balance,
          academicYear: f.academicYear as string,
          feeStructureDoc: f.feeStructureDoc,
        })),
      ),
    [selectedFees],
  );

  const removeFee = useCallback(
    (feeId: string) => {
      const idsToRemove = getSequentialRemovalIds(feeId, feesForRemoval);
      setSelectedFeeIds((prev) => {
        const next = new Set(prev);
        for (const id of idsToRemove) {
          next.delete(id);
        }
        return next;
      });
    },
    [feesForRemoval],
  );

  const toggleStructureExpanded = useCallback((structureId: string) => {
    setExpandedStructures((prev) => {
      const next = new Set(prev);
      if (next.has(structureId)) {
        next.delete(structureId);
      } else {
        next.add(structureId);
      }
      return next;
    });
  }, []);

  const handleAddFutureMonths = useCallback(
    async (
      feeStructureId: Id<"feeStructure">,
      academicYear: Id<"academicYears">,
      periods: string[],
    ) => {
      try {
        const newFeeIds = await createFutureMonthFees({
          studentId,
          feeStructureId,
          academicYear,
          billingPeriods: periods,
        });
        setSelectedFeeIds((prev) => {
          const next = new Set(prev);
          for (const id of newFeeIds) {
            next.add(id);
          }
          return next;
        });
        setExpandedStructures((prev) => {
          const next = new Set(prev);
          next.delete(feeStructureId as string);
          return next;
        });
        toast.success(`Added ${periods.length} future month(s)`);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to add future months";
        toast.error(message);
      }
    },
    [studentId, createFutureMonthFees],
  );

  async function handleCollect() {
    if (selectedFees.length === 0) {
      toast.error("No fees selected");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await collectFees({
        studentId,
        feeIds: selectedFees.map((f) => f._id),
        paymentMode,
        remarks: remarks || undefined,
      });
      toast.success(
        `Payment recorded. Invoice: ${result.invoiceNumber}. Total: ৳${result.totalAmount.toLocaleString()}`,
      );
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Fee collection failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Collect Fees</DialogTitle>
          <DialogDescription>
            {selectedFees.length} fee(s) selected for collection
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-2">
            {/* Selected fees list */}
            <div className="space-y-2">
              {selectedFees.map((fee) => {
                const totalDiscounts = fee.enrichedDiscounts.reduce(
                  (s, d) => s + d.amount,
                  0,
                );
                return (
                  <div
                    key={fee._id}
                    className="bg-gray-50 border rounded-lg p-3 relative"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => removeFee(fee._id as string)}
                      aria-label={`Remove ${fee.feeStructureDoc?.feeType ?? "fee"} from collection`}
                      disabled={selectedFees.length <= 1}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>

                    <div className="pr-8">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium capitalize">
                          {fee.feeStructureDoc?.feeType ?? "Fee"}
                        </span>
                        {fee.billingPeriod && (
                          <Badge variant="outline" className="text-xs">
                            {formatBillingPeriod(fee.billingPeriod)}
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Original</span>
                          <span>৳{fee.originalAmount.toLocaleString()}</span>
                        </div>
                        {totalDiscounts > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>
                              Discounts (
                              {fee.enrichedDiscounts
                                .map((d) => d.ruleName)
                                .join(", ")}
                              )
                            </span>
                            <span>-৳{totalDiscounts.toLocaleString()}</span>
                          </div>
                        )}
                        {fee.paidAmount > 0 && (
                          <div className="flex justify-between text-blue-600">
                            <span>Already Paid</span>
                            <span>-৳{fee.paidAmount.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium text-gray-900 pt-0.5 border-t border-gray-200">
                          <span>To Collect</span>
                          <span>৳{fee.balance.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Per-structure "Add Future Months" sections */}
            {monthlyGroups.map((group) => (
              <PerStructureFutureMonths
                key={group.feeStructureId}
                group={group}
                studentId={studentId}
                isExpanded={expandedStructures.has(group.feeStructureId)}
                onToggle={() => toggleStructureExpanded(group.feeStructureId)}
                onAdd={(periods) =>
                  handleAddFutureMonths(
                    group.feeStructureId as Id<"feeStructure">,
                    group.academicYear as Id<"academicYears">,
                    periods,
                  )
                }
              />
            ))}

            <Separator />

            {/* Grand total */}
            <div className="bg-school-green/5 border border-school-green/20 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">
                  Grand Total
                </span>
                <span className="text-xl font-bold text-school-green">
                  ৳{grandTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment mode */}
            <div className="space-y-1.5">
              <label
                htmlFor="payment-mode-select"
                className="text-sm font-medium text-gray-700"
              >
                Payment Mode
              </label>
              <Select
                value={paymentMode}
                onValueChange={(v) =>
                  setPaymentMode(v as (typeof PAYMENT_MODES)[number])
                }
              >
                <SelectTrigger id="payment-mode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <label
                htmlFor="collection-remarks"
                className="text-sm font-medium text-gray-700"
              >
                Remarks (optional)
              </label>
              <Textarea
                id="collection-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any notes about this collection..."
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCollect}
                disabled={isSubmitting || selectedFees.length === 0}
                className="bg-school-green hover:bg-school-green/90 text-white"
                aria-label="Confirm fee collection"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Collect ৳${grandTotal.toLocaleString()}`
                )}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ── Per-Structure Future Months Section ──────────────────────────────────────

interface PerStructureFutureMonthsProps {
  group: {
    feeStructureId: string;
    structureName: string;
    feeType: string;
    academicYear: string;
  };
  studentId: Id<"students">;
  isExpanded: boolean;
  onToggle: () => void;
  onAdd: (periods: string[]) => Promise<void>;
}

function PerStructureFutureMonths({
  group,
  studentId,
  isExpanded,
  onToggle,
  onAdd,
}: PerStructureFutureMonthsProps) {
  const futureMonths = useQuery(api.feeCollectionSessions.getFutureMonths, {
    studentId,
    feeStructureId: group.feeStructureId as Id<"feeStructure">,
    academicYear: group.academicYear as Id<"academicYears">,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  // Hide section if no future months available
  if (futureMonths !== undefined && futureMonths.length === 0) {
    return null;
  }

  function toggleMonth(period: string) {
    setSelected((prev) => {
      const sorted = (futureMonths ?? []).map((m) => m.billingPeriod).sort();
      const idx = sorted.indexOf(period);
      const next = new Set(prev);

      if (prev.has(period)) {
        // Remove this and all subsequent months (sequential constraint)
        for (let i = idx; i < sorted.length; i++) {
          next.delete(sorted[i]);
        }
      } else {
        // Add this and all preceding months (sequential constraint)
        for (let i = 0; i <= idx; i++) {
          next.add(sorted[i]);
        }
      }
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setIsAdding(true);
    try {
      await onAdd(Array.from(selected).sort());
      setSelected(new Set());
    } finally {
      setIsAdding(false);
    }
  }

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onToggle}
        aria-label={`Add future months for ${group.structureName}`}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Future Months — {group.structureName}
      </Button>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 capitalize">
          Future Months — {group.structureName}
        </h4>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onToggle}
          aria-label={`Close future months for ${group.structureName}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {futureMonths === undefined ? (
        <div className="text-sm text-gray-400 text-center py-2">
          Loading available months...
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {futureMonths.map((m) => (
            <button
              key={m.billingPeriod}
              type="button"
              onClick={() => toggleMonth(m.billingPeriod)}
              className={`text-xs p-2 rounded-lg border transition-colors ${
                selected.has(m.billingPeriod)
                  ? "bg-school-green/10 border-school-green text-school-green font-medium"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
              aria-label={`Select ${formatBillingPeriod(m.billingPeriod)} for ${group.structureName}`}
              aria-pressed={selected.has(m.billingPeriod)}
            >
              <div>{formatBillingPeriod(m.billingPeriod)}</div>
              <div className="text-[10px] mt-0.5 opacity-70">
                ৳{m.amount.toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onToggle}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={selected.size === 0 || isAdding}
          className="bg-school-green hover:bg-school-green/90 text-white"
          aria-label={`Add selected future months for ${group.structureName}`}
        >
          {isAdding ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : null}
          Add {selected.size} Month(s)
        </Button>
      </div>
    </div>
  );
}
