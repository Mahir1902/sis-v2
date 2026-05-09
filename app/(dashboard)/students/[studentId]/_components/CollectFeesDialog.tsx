"use client";

import { useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

// ── Grouping helpers ─────────────────────────────────────────────────────────

interface FeeGroup {
  key: string;
  structureName: string;
  feeType: string;
  frequency: string;
  fees: FeeForCollection[];
  totalBalance: number;
  dateRange: string | null;
}

/**
 * Groups selected fees for compact display. Monthly fees with the same
 * feeStructureId are collapsed into one row. Non-monthly fees or fees
 * without billingPeriod remain as individual items.
 */
function groupFeesForDisplay(fees: FeeForCollection[]): FeeGroup[] {
  const monthlyBuckets = new Map<string, FeeForCollection[]>();
  const singles: FeeForCollection[] = [];

  for (const fee of fees) {
    if (fee.feeStructureDoc?.frequency === "monthly" && fee.billingPeriod) {
      const bucket = monthlyBuckets.get(fee.feeStructureId as string) ?? [];
      bucket.push(fee);
      monthlyBuckets.set(fee.feeStructureId as string, bucket);
    } else {
      singles.push(fee);
    }
  }

  const groups: FeeGroup[] = [];

  for (const [structId, bucket] of monthlyBuckets) {
    const sorted = [...bucket].sort((a, b) =>
      (a.billingPeriod ?? "").localeCompare(b.billingPeriod ?? ""),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const dateRange =
      sorted.length > 1
        ? `${formatBillingPeriod(first.billingPeriod)} – ${formatBillingPeriod(last.billingPeriod)}`
        : formatBillingPeriod(first.billingPeriod);

    groups.push({
      key: `monthly-${structId}`,
      structureName: first.feeStructureDoc?.name ?? "Monthly Fee",
      feeType: first.feeStructureDoc?.feeType ?? "fee",
      frequency: "monthly",
      fees: sorted,
      totalBalance: sorted.reduce((s, f) => s + f.balance, 0),
      dateRange,
    });
  }

  // Add non-monthly fees as individual groups
  for (const fee of singles) {
    groups.push({
      key: `single-${fee._id}`,
      structureName: fee.feeStructureDoc?.name ?? "Fee",
      feeType: fee.feeStructureDoc?.feeType ?? "fee",
      frequency: fee.feeStructureDoc?.frequency ?? "one-time",
      fees: [fee],
      totalBalance: fee.balance,
      dateRange: fee.billingPeriod
        ? formatBillingPeriod(fee.billingPeriod)
        : null,
    });
  }

  return groups;
}

// ── Main Dialog ──────────────────────────────────────────────────────────────

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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  const feeGroups = useMemo(
    () => groupFeesForDisplay(selectedFees),
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

  const removeGroup = useCallback((group: FeeGroup) => {
    setSelectedFeeIds((prev) => {
      const next = new Set(prev);
      for (const fee of group.fees) {
        next.delete(fee._id as string);
      }
      return next;
    });
  }, []);

  const toggleGroupExpanded = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleStructureExpanded = useCallback((structureId: string) => {
    setExpandedStructures((prev) => {
      const next = new Set(prev);
      if (next.has(structureId)) next.delete(structureId);
      else next.add(structureId);
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

        <ScrollArea className="flex-1 -mx-6 px-6 max-h-[50vh]">
          <div className="space-y-3 pb-2">
            {/* Grouped fee display */}
            {feeGroups.map((group) => {
              const isMulti = group.fees.length > 1;
              const isExpanded = expandedGroups.has(group.key);

              return (
                <div key={group.key} className="bg-gray-50 border rounded-lg">
                  {/* Compact summary row */}
                  <div className="flex items-center gap-2 p-3">
                    {isMulti && (
                      <button
                        type="button"
                        onClick={() => toggleGroupExpanded(group.key)}
                        className="text-gray-400 hover:text-gray-600 shrink-0"
                        aria-label={
                          isExpanded
                            ? `Collapse ${group.structureName} details`
                            : `Expand ${group.structureName} details`
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize truncate">
                          {group.feeType}
                        </span>
                        {isMulti && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            ×{group.fees.length}
                          </Badge>
                        )}
                        {group.dateRange && (
                          <span className="text-xs text-gray-400 truncate">
                            {group.dateRange}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-sm font-semibold text-gray-900 shrink-0">
                      ৳{group.totalBalance.toLocaleString()}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() =>
                        isMulti
                          ? removeGroup(group)
                          : removeFee(group.fees[0]._id as string)
                      }
                      aria-label={`Remove ${group.structureName} from collection`}
                      disabled={feeGroups.length <= 1 && group.fees.length <= 1}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Expanded individual fee rows */}
                  {isExpanded && isMulti && (
                    <div className="border-t px-3 pb-2 pt-1 space-y-1">
                      {group.fees.map((fee) => (
                        <div
                          key={fee._id}
                          className="flex items-center justify-between text-xs py-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">
                              {formatBillingPeriod(fee.billingPeriod)}
                            </span>
                            {fee.paidAmount > 0 && (
                              <span className="text-blue-600">
                                (৳{fee.paidAmount.toLocaleString()} paid)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-700">
                              ৳{fee.balance.toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFee(fee._id as string)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              aria-label={`Remove ${formatBillingPeriod(fee.billingPeriod)} from collection`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

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
          </div>
        </ScrollArea>

        <Separator />

        {/* Fixed bottom section — never scrolls */}
        <div className="space-y-3 pt-1">
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

          {/* Payment mode + remarks in a compact row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="payment-mode-select"
                className="text-xs font-medium text-gray-500"
              >
                Payment Mode
              </label>
              <Select
                value={paymentMode}
                onValueChange={(v) =>
                  setPaymentMode(v as (typeof PAYMENT_MODES)[number])
                }
              >
                <SelectTrigger id="payment-mode-select" className="h-9">
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

            <div className="space-y-1">
              <label
                htmlFor="collection-remarks"
                className="text-xs font-medium text-gray-500"
              >
                Remarks (optional)
              </label>
              <Textarea
                id="collection-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any notes..."
                rows={1}
                className="h-9 min-h-9 resize-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
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
        </DialogFooter>
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
        for (let i = idx; i < sorted.length; i++) {
          next.delete(sorted[i]);
        }
      } else {
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
