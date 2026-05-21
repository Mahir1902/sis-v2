"use client";

import { useQuery } from "convex/react";
import { CreditCard, GraduationCap, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  formatCurrency,
  formatLineItem,
  formatTransactionDate,
  getStatusBadgeStyle,
} from "@/lib/transactionLogUtils";

interface SessionDetailSheetProps {
  sessionId: Id<"feeCollectionSessions"> | null;
  onClose: () => void;
}

export function SessionDetailSheet({
  sessionId,
  onClose,
}: SessionDetailSheetProps) {
  const detail = useQuery(
    api.transactionLog.getSessionDetail,
    sessionId ? { sessionId } : "skip",
  );

  return (
    <Sheet open={!!sessionId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {!detail ? (
          <SessionDetailSkeleton />
        ) : (
          <SessionDetailContent
            session={detail.session}
            lineItems={detail.lineItems}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SessionDetailContent({
  session,
  lineItems,
}: {
  session: {
    invoiceNumber: string;
    transactionDate: number;
    status: "completed" | "voided";
    campus: string | null;
    totalAmount: number;
    paymentMode: string;
    remarks: string | null;
    studentName: string;
    studentNumber: string;
    collectedByName: string;
  };
  lineItems: Array<{
    _id: string;
    amount: number;
    feeStructureName: string;
    billingPeriod?: string;
    referenceNumber?: string;
  }>;
}) {
  return (
    <>
      <SheetHeader className="border-b px-6 pb-4">
        <div className="flex items-center gap-3">
          <SheetTitle className="font-mono text-lg">
            {session.invoiceNumber}
          </SheetTitle>
          <Badge
            variant="secondary"
            className={getStatusBadgeStyle(session.status)}
          >
            {session.status === "completed" ? "Completed" : "Voided"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatTransactionDate(session.transactionDate)}
        </p>
      </SheetHeader>

      <div className="space-y-5 px-6 py-5">
        {/* Student Info */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-school-green/10 text-school-green">
            <GraduationCap className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {session.studentName}
            </p>
            <p className="text-xs text-muted-foreground">
              {session.studentNumber}
            </p>
          </div>
        </div>

        {/* Payment Details */}
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Payment Details</h3>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Payment Mode
              </p>
              <p className="mt-0.5 text-sm">{session.paymentMode}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Campus
              </p>
              <p className="mt-0.5 text-sm">{session.campus ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Collected By
              </p>
              <p className="mt-0.5 text-sm">{session.collectedByName}</p>
            </div>
            {session.remarks && (
              <div className="col-span-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Remarks
                </p>
                <p className="mt-0.5 text-sm">{session.remarks}</p>
              </div>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Fee Line Items</h3>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Fee</TableHead>
                  <TableHead className="text-xs">Period</TableHead>
                  <TableHead className="text-right text-xs">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((txn) => {
                  const formatted = formatLineItem(txn);
                  return (
                    <TableRow key={txn._id}>
                      <TableCell className="text-sm">
                        {formatted.label}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatted.period}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatted.amount}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {lineItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No line items
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            Total
          </span>
          <span className="text-lg font-bold">
            {formatCurrency(session.totalAmount)}
          </span>
        </div>
      </div>
    </>
  );
}

function SessionDetailSkeleton() {
  return (
    <>
      <SheetHeader className="border-b px-6 pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-24" />
      </SheetHeader>
      <div className="space-y-5 px-6 py-5">
        {/* Student info skeleton */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Payment details skeleton */}
        <div className="rounded-lg border p-4">
          <Skeleton className="mb-3 h-4 w-28" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {Array.from({ length: 4 }, (_, i) => `detail-sk-${i}`).map(
              (key) => (
                <div key={key} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ),
            )}
          </div>
        </div>

        {/* Line items skeleton */}
        <div>
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="space-y-0 overflow-hidden rounded-lg border">
            {Array.from({ length: 3 }, (_, i) => `line-sk-${i}`).map((key) => (
              <Skeleton key={key} className="h-10 w-full rounded-none" />
            ))}
          </div>
        </div>

        {/* Total skeleton */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
    </>
  );
}
