"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import { fmtDayMonthYear } from "@/lib/dateFormat";
import type { ReceiptListRow } from "@/lib/receiptsListFilter";

export type ReceiptRow = ReceiptListRow;

export const columns: ColumnDef<ReceiptRow>[] = [
  {
    accessorKey: "receiptNumber",
    header: "Receipt #",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{row.original.receiptNumber}</span>
        {row.original.supersededBy && (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-50 text-red-700"
            aria-label="This receipt was superseded by a re-issued receipt"
          >
            <Repeat className="mr-1 h-3 w-3" aria-hidden />
            Superseded
          </Badge>
        )}
        {row.original.supersedes && (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-800"
            aria-label="This receipt was re-issued to replace an earlier receipt"
          >
            <Repeat className="mr-1 h-3 w-3" aria-hidden />
            Re-issued
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: "paymentDate",
    header: "Payment Date",
    cell: ({ row }) => (
      <span className="text-sm text-gray-700">
        {fmtDayMonthYear(row.original.paymentDate)}
      </span>
    ),
  },
  {
    accessorKey: "studentNameSnapshot",
    header: "Student",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">
          {row.original.studentNameSnapshot}
        </span>
        <span className="text-xs text-gray-500">
          {row.original.studentNumberSnapshot}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "payerName",
    header: "Payer",
    cell: ({ row }) => (
      <span className="text-sm text-gray-700">{row.original.payerName}</span>
    ),
  },
  {
    accessorKey: "paymentMethod",
    header: "Method",
    cell: ({ row }) => (
      <span className="text-sm text-gray-700">
        {row.original.paymentMethod}
      </span>
    ),
  },
  {
    accessorKey: "totalAmount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => (
      <div className="text-right text-sm font-medium text-gray-900">
        {formatCurrency(row.original.totalAmount)}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      const className =
        status === "issued"
          ? "bg-green-100 text-green-800 hover:bg-green-100"
          : "bg-gray-200 text-gray-700 hover:bg-gray-200";
      return (
        <Badge className={className} aria-label={`Status: ${status}`}>
          {status === "issued" ? "Issued" : "Voided"}
        </Badge>
      );
    },
  },
];
