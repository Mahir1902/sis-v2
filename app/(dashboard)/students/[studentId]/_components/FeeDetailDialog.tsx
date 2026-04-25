"use client";

import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { CreditCard, Receipt, Tag } from "lucide-react";
import { useState } from "react";
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

// ── Types ──────────────────────────────────────────────────────────────────────

interface AppliedDiscount {
  discountId: Id<"discountRules">;
  type: string;
  amount: number;
}

interface PaymentDetail {
  paymentId: Id<"feeTransactions">;
  date: string;
  amount: number;
  mode: string;
}

interface FeeRecord {
  _id: Id<"studentFees">;
  originalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  dueDate: number;
  academicYear: Id<"academicYears">;
  appliedDiscounts: AppliedDiscount[];
  paymentDetails: PaymentDetail[];
  feeStructureDoc?: { feeType?: string; name?: string } | null;
  academicYearDoc?: { name?: string } | null;
}

interface FeeDetailDialogProps {
  open: boolean;
  onClose: () => void;
  fee: FeeRecord;
  studentId: Id<"students">;
  onCollectFee: () => void;
}

// ── Status badge styles ────────────────────────────────────────────────────────

const feeStatusStyles: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  partial: "bg-yellow-100 text-yellow-700 border-yellow-200",
  unpaid: "bg-red-100 text-red-700 border-red-200",
};

// ── Main Dialog ────────────────────────────────────────────────────────────────

export function FeeDetailDialog({
  open,
  onClose,
  fee,
  studentId,
  onCollectFee,
}: FeeDetailDialogProps) {
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);

  const totalDiscounts = fee.appliedDiscounts.reduce(
    (sum, d) => sum + d.amount,
    0,
  );

  const feeLabel =
    fee.feeStructureDoc?.feeType ?? fee.feeStructureDoc?.name ?? "Fee";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="capitalize">{feeLabel} Details</DialogTitle>
          <DialogDescription>
            {fee.academicYearDoc?.name
              ? `Academic Year: ${fee.academicYearDoc.name}`
              : "Fee breakdown and payment history"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-2">
            {/* ── Section 1: Fee Breakdown ─────────────────────────────── */}
            <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-4 w-4 text-gray-500" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-gray-700">
                  Fee Breakdown
                </h3>
              </div>

              {/* Original amount */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Original Amount</span>
                <span className="font-medium">
                  ৳{fee.originalAmount.toLocaleString()}
                </span>
              </div>

              {/* Applied discounts */}
              {fee.appliedDiscounts.length > 0 && (
                <>
                  {fee.appliedDiscounts.map((discount, idx) => (
                    <div
                      key={`${String(discount.discountId)}-${idx}`}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-green-600 capitalize">
                        {discount.type === "percentage"
                          ? "Percentage Discount"
                          : "Fixed Discount"}
                      </span>
                      <span className="text-green-600 font-medium">
                        -৳{discount.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}

                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-green-700">Total Discounts</span>
                    <span className="text-green-700">
                      -৳{totalDiscounts.toLocaleString()}
                    </span>
                  </div>
                </>
              )}

              <Separator />

              {/* Paid */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Paid</span>
                <span className="font-medium text-green-700">
                  ৳{fee.paidAmount.toLocaleString()}
                </span>
              </div>

              {/* Balance */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Balance</span>
                <span
                  className={cn(
                    "font-medium",
                    fee.balance > 0 ? "text-red-600" : "text-green-700",
                  )}
                >
                  ৳{fee.balance.toLocaleString()}
                </span>
              </div>

              {/* Status */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Status</span>
                <Badge
                  variant="outline"
                  className={feeStatusStyles[fee.status]}
                >
                  {fee.status}
                </Badge>
              </div>

              {/* Due date */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Due Date</span>
                <span className="text-gray-700">
                  {format(new Date(fee.dueDate), "dd/MM/yyyy")}
                </span>
              </div>
            </div>

            {/* ── Section 2: Payment History ───────────────────────────── */}
            <PaymentHistorySection feeId={fee._id} />

            {/* ── Section 3: Actions ───────────────────────────────────── */}
            {fee.balance > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDiscountDialog(true)}
                  aria-label="Apply a discount to this fee"
                >
                  <Tag className="h-4 w-4 mr-2" aria-hidden="true" />
                  Apply Discount
                </Button>
                <Button
                  className="flex-1 bg-school-green hover:bg-school-green/90 text-white"
                  onClick={onCollectFee}
                  aria-label="Collect payment for this fee"
                >
                  <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />
                  Collect Fee
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Apply Discount Sub-Dialog ──────────────────────────────── */}
        {showDiscountDialog && (
          <ApplyDiscountSubDialog
            open={showDiscountDialog}
            onClose={() => setShowDiscountDialog(false)}
            fee={fee}
            studentId={studentId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Payment History Section ────────────────────────────────────────────────────

function PaymentHistorySection({ feeId }: { feeId: Id<"studentFees"> }) {
  const transactions = useQuery(api.feeTransactions.getByFee, { feeId });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-700">Payment History</h3>
      </div>

      {transactions === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton elements never reorder
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <CreditCard
            className="h-8 w-8 text-gray-300 mx-auto mb-2"
            aria-hidden="true"
          />
          <p className="text-sm text-gray-500">No payments recorded yet</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
                <TableHead className="text-xs">Mode</TableHead>
                <TableHead className="text-xs">Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...transactions]
                .sort((a, b) => b.transactionDate - a.transactionDate)
                .map((txn) => (
                  <TableRow key={txn._id}>
                    <TableCell className="text-sm">
                      {format(new Date(txn.transactionDate), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium text-green-700">
                      ৳{txn.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {txn.paymentMode}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 font-mono text-xs">
                      {txn.referenceNumber ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Apply Discount Sub-Dialog ──────────────────────────────────────────────────

interface DiscountRule {
  _id: Id<"discountRules">;
  _creationTime: number;
  name: string;
  discountType: "percentage" | "fixed";
  amount: number;
  maxDiscountAmount?: number;
  isActive?: boolean;
  description?: string;
  discription?: string;
  startDate?: string;
  endDate?: string;
}

function ApplyDiscountSubDialog({
  open,
  onClose,
  fee,
  studentId,
}: {
  open: boolean;
  onClose: () => void;
  fee: FeeRecord;
  studentId: Id<"students">;
}) {
  const [selectedRuleId, setSelectedRuleId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const discountRules = useQuery(api.discounts.list);
  const applyDiscount = useMutation(api.studentDiscounts.applyDiscount);

  const activeRules: DiscountRule[] = (discountRules ?? []).filter(
    (r): r is DiscountRule => r.isActive === true,
  );

  const selectedRule = activeRules.find(
    (r) => String(r._id) === selectedRuleId,
  );

  // Calculate preview discount amount
  function computeDiscountPreview(rule: DiscountRule): number {
    let discountAmount: number;
    if (rule.discountType === "percentage") {
      discountAmount = (fee.originalAmount * rule.amount) / 100;
      if (rule.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, rule.maxDiscountAmount);
      }
    } else {
      discountAmount = rule.amount;
    }
    return Math.min(discountAmount, fee.balance);
  }

  const previewAmount = selectedRule ? computeDiscountPreview(selectedRule) : 0;

  async function handleApplyDiscount() {
    if (!selectedRule) return;
    setIsSubmitting(true);
    try {
      const { discountAmount } = await applyDiscount({
        studentId,
        feeId: fee._id,
        discountRuleId: selectedRule._id,
        academicYear: fee.academicYearDoc?.name ?? "",
      });
      toast.success(
        `Discount of ৳${discountAmount.toLocaleString()} applied successfully`,
      );
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to apply discount";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Apply Discount</DialogTitle>
          <DialogDescription>
            Select a discount rule to apply to this fee.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {discountRules === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : activeRules.length === 0 ? (
            <div className="text-center py-6 border border-dashed rounded-lg">
              <Tag
                className="h-8 w-8 text-gray-300 mx-auto mb-2"
                aria-hidden="true"
              />
              <p className="text-sm text-gray-500">
                No active discount rules available
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="discount-rule-select"
                  className="text-sm font-medium text-gray-700"
                >
                  Discount Rule
                </label>
                <Select
                  value={selectedRuleId}
                  onValueChange={setSelectedRuleId}
                >
                  <SelectTrigger id="discount-rule-select">
                    <SelectValue placeholder="Select a discount rule" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRules.map((rule) => (
                      <SelectItem key={rule._id} value={String(rule._id)}>
                        {rule.name}{" "}
                        <span className="text-gray-400">
                          (
                          {rule.discountType === "percentage"
                            ? `${rule.amount}%`
                            : `৳${rule.amount.toLocaleString()}`}
                          )
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Discount preview */}
              {selectedRule && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">
                    This will apply a{" "}
                    <span className="font-bold">
                      ৳{previewAmount.toLocaleString()}
                    </span>{" "}
                    discount
                  </p>
                  {selectedRule.discountType === "percentage" && (
                    <p className="text-xs text-green-600 mt-1">
                      {selectedRule.amount}% of ৳
                      {fee.originalAmount.toLocaleString()}
                      {selectedRule.maxDiscountAmount
                        ? `, capped at ৳${selectedRule.maxDiscountAmount.toLocaleString()}`
                        : ""}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    New balance: ৳
                    {(fee.balance - previewAmount).toLocaleString()}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleApplyDiscount}
                  disabled={!selectedRule || isSubmitting}
                  className="bg-school-green hover:bg-school-green/90 text-white"
                  aria-label="Confirm and apply the selected discount"
                >
                  {isSubmitting ? "Applying..." : "Apply Discount"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
