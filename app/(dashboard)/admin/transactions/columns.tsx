"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { Id } from "@/convex/_generated/dataModel";
import {
  formatCurrency,
  formatTransactionDate,
  getStatusBadgeStyle,
} from "@/lib/transactionLogUtils";

export type SessionRow = {
  _id: Id<"feeCollectionSessions">;
  invoiceNumber: string;
  transactionDate: number;
  campus: string | null;
  totalAmount: number;
  paymentMode: string;
  status: "completed" | "voided";
  feeCount: number;
  studentName: string;
  studentNumber: string;
  collectedByName: string;
};

const PAYMENT_MODE_STYLES: Record<string, string> = {
  Cash: "bg-emerald-400/40 text-emerald-700",
  "Bank Transfer": "bg-blue-400/40 text-blue-700",
  Cheque: "bg-amber-400/40 text-amber-700",
  UPI: "bg-violet-400/40 text-violet-700",
  Online: "bg-cyan-400/40 text-cyan-700",
};

export const columns: ColumnDef<SessionRow>[] = [
  {
    accessorKey: "transactionDate",
    header: "Date",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm">
        {formatTransactionDate(row.original.transactionDate)}
      </span>
    ),
  },
  {
    accessorKey: "invoiceNumber",
    header: "Invoice #",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.invoiceNumber}</span>
    ),
  },
  {
    id: "student",
    header: "Student",
    accessorFn: (row) => `${row.studentName} ${row.studentNumber}`,
    cell: ({ row }) => (
      <div className="min-w-[140px]">
        <p className="text-sm font-medium">{row.original.studentName}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.studentNumber}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "campus",
    header: "Campus",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.campus ?? "—"}</span>
    ),
  },
  {
    accessorKey: "totalAmount",
    header: () => <span className="flex justify-end">Amount</span>,
    cell: ({ row }) => (
      <span className="flex justify-end font-medium text-sm">
        {formatCurrency(row.original.totalAmount)}
      </span>
    ),
  },
  {
    accessorKey: "paymentMode",
    header: "Payment Mode",
    cell: ({ row }) => {
      const mode = row.original.paymentMode;
      return (
        <Badge
          variant="secondary"
          className={
            PAYMENT_MODE_STYLES[mode] ?? "bg-gray-400/40 text-gray-700"
          }
        >
          {mode}
        </Badge>
      );
    },
  },
  {
    accessorKey: "collectedByName",
    header: "Collected By",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.collectedByName}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={getStatusBadgeStyle(row.original.status)}
      >
        {row.original.status === "completed" ? "Completed" : "Voided"}
      </Badge>
    ),
  },
  {
    accessorKey: "feeCount",
    header: () => <span className="flex justify-end">Fee Count</span>,
    cell: ({ row }) => (
      <span className="flex justify-end text-sm">{row.original.feeCount}</span>
    ),
  },
];
