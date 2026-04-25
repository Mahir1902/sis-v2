"use client";

import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { DollarSign, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
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
  const [collectFeeId, setCollectFeeId] = useState<Id<"studentFees"> | null>(
    null,
  );
  const [detailFeeId, setDetailFeeId] = useState<Id<"studentFees"> | null>(
    null,
  );

  const fees = useQuery(api.studentFees.getByStudent, { studentId });

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

  // Summary totals
  const totalFees = fees.reduce((s, f) => s + f.originalAmount, 0);
  const totalPaid = fees.reduce((s, f) => s + f.paidAmount, 0);
  const totalBalance = fees.reduce((s, f) => s + f.balance, 0);

  const collectFee = fees.find((f) => f._id === collectFeeId);
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

      {/* Fees table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Fee Type</TableHead>
              <TableHead>Academic Year</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.map((fee) => (
              <TableRow
                key={fee._id}
                className={cn(
                  "cursor-pointer hover:bg-gray-50 transition-colors",
                  fee.status === "unpaid" && "bg-red-50/50",
                )}
                onClick={() => setDetailFeeId(fee._id)}
              >
                <TableCell className="font-medium capitalize">
                  {fee.feeStructureDoc?.feeType ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {fee.academicYearDoc?.name ?? "—"}
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
                  <Badge variant="outline" className={statusStyles[fee.status]}>
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
                          onClick={() => setCollectFeeId(fee._id)}
                        >
                          Collect Fee
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Collect Fee dialog */}
      {collectFee && (
        <CollectFeeDialog
          open={!!collectFeeId}
          onClose={() => setCollectFeeId(null)}
          fee={collectFee}
          studentId={studentId}
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
            setCollectFeeId(detailFee._id);
          }}
        />
      )}
    </div>
  );
}

// ── Collect Fee Dialog ────────────────────────────────────────────────────────

interface FeeRecord {
  _id: Id<"studentFees">;
  originalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  academicYear: Id<"academicYears">;
  feeStructureDoc?: { feeType?: string; name?: string } | null;
}

function CollectFeeDialog({
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
  const [amount, setAmount] = useState<string>(String(fee.balance));
  const [paymentMode, setPaymentMode] = useState<string>("Cash");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createTxn = useMutation(api.feeTransactions.createTransaction);

  const parsedAmount = parseFloat(amount) || 0;
  const _isAdvance = parsedAmount > fee.balance;

  async function handleSubmit() {
    if (parsedAmount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (parsedAmount > fee.balance) {
      toast.error("Amount cannot exceed outstanding balance");
      return;
    }
    setIsSubmitting(true);
    try {
      const { referenceNumber } = await createTxn({
        studentId,
        feeId: fee._id,
        academicYear: fee.academicYear,
        amount: parsedAmount,
        paymentMode: paymentMode as
          | "Cash"
          | "Bank Transfer"
          | "Cheque"
          | "UPI"
          | "Online",
        transactionDate: new Date(paymentDate).getTime(),
        remarks: remarks || undefined,
      });
      toast.success(`Payment recorded. Ref: ${referenceNumber}`);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Collect Fee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Outstanding balance */}
          <div className="bg-red-50 border border-red-100 rounded-lg p-3">
            <p className="text-xs text-red-500 font-medium uppercase tracking-wide">
              Outstanding Balance
            </p>
            <p className="text-2xl font-bold text-red-600 mt-0.5">
              ৳{fee.balance.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1 capitalize">
              {fee.feeStructureDoc?.feeType ?? "Fee"}
            </p>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>Payment Amount</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
              max={fee.balance}
              step={0.01}
            />
            {parsedAmount > 0 && parsedAmount < fee.balance && (
              <p className="text-xs text-yellow-600">
                Partial payment — ৳
                {(fee.balance - parsedAmount).toLocaleString()} will remain
                outstanding
              </p>
            )}
          </div>

          {/* Payment mode */}
          <div className="space-y-1.5">
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Cash", "Bank Transfer", "Cheque", "UPI", "Online"].map(
                  (m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Payment Date</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <Label>Remarks (optional)</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any notes about this payment…"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting || parsedAmount <= 0 || parsedAmount > fee.balance
              }
              className="bg-school-green hover:bg-school-green/90 text-white"
            >
              {isSubmitting ? "Processing…" : "Record Payment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
