"use client";

import { Download, FileText, MoreHorizontal, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import type { Id } from "@/convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";
import { fmtDayMonthYear } from "@/lib/dateFormat";
import {
  formatStatusBadgeClass,
  formatStatusDotClass,
  formatStatusLabel,
  type InvoiceStatus,
  shouldDisableVoid,
  shouldRenderDueDateRed,
} from "@/lib/invoiceTableUtils";
import { cn } from "@/lib/utils";

/**
 * The shape of a row delivered by `api.invoices.getInvoices` — kept narrow so
 * the table is decoupled from the Convex generated return type. The page
 * passes the slice straight through.
 */
export interface InvoiceRow {
  _id: Id<"invoices">;
  invoiceNumber: string;
  studentId: Id<"students">;
  studentName: string;
  studentNumber: string;
  standardLevelName: string;
  campusName: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: InvoiceStatus;
  issueDate: number;
  dueDate: number;
}

interface Props {
  rows: InvoiceRow[];
  now: number;
  onView: (invoiceId: Id<"invoices">) => void;
  onSend: (invoiceId: Id<"invoices">) => void;
  onDownloadPdf: (invoiceId: Id<"invoices">) => void;
  onVoid: (invoiceId: Id<"invoices">, invoiceNumber: string) => void;
  /** Footer totals derived from getInvoiceAggregates — undefined while loading. */
  footerTotals?: {
    totalAmount: number;
    balance: number;
  };
  /** Set of selected invoice ids (drives row highlight + checkbox state). */
  selectedIds: Set<Id<"invoices">>;
  /** Toggle one row in or out of the selection. */
  onToggleRow: (invoiceId: Id<"invoices">) => void;
  /** Toggle every row in the current visible slice in or out of the selection. */
  onToggleAll: () => void;
}

export function InvoiceTable({
  rows,
  now,
  onView,
  onSend,
  onDownloadPdf,
  onVoid,
  footerTotals,
  selectedIds,
  onToggleRow,
  onToggleAll,
}: Props) {
  // Tri-state header checkbox semantics. Radix's `checked` accepts the literal
  // string "indeterminate" for the mixed state.
  const allSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(r._id));
  const someSelected =
    rows.length > 0 && rows.some((r) => selectedIds.has(r._id));
  const headerCheckedValue: boolean | "indeterminate" = allSelected
    ? true
    : someSelected
      ? "indeterminate"
      : false;

  return (
    <div className="rounded-lg border bg-white">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={headerCheckedValue}
                  onCheckedChange={onToggleAll}
                  aria-label="Select all visible invoices"
                  data-testid="invoice-table-select-all"
                />
              </TableHead>
              <TableHead className="min-w-[140px]">Invoice #</TableHead>
              <TableHead className="min-w-[180px]">Student</TableHead>
              <TableHead className="min-w-[100px]">Class</TableHead>
              <TableHead className="min-w-[120px]">Campus</TableHead>
              <TableHead className="min-w-[110px]">Issue Date</TableHead>
              <TableHead className="min-w-[110px]">Due Date</TableHead>
              <TableHead className="min-w-[110px]">Status</TableHead>
              <TableHead className="min-w-[110px] text-right">Total</TableHead>
              <TableHead className="min-w-[110px] text-right">
                Balance
              </TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <InvoiceTableRow
                key={row._id}
                row={row}
                now={now}
                onView={onView}
                onSend={onSend}
                onDownloadPdf={onDownloadPdf}
                onVoid={onVoid}
                isSelected={selectedIds.has(row._id)}
                onToggle={onToggleRow}
              />
            ))}
          </TableBody>
          {footerTotals && rows.length > 0 && (
            <tfoot className="border-t bg-gray-50/50 text-sm">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-700" colSpan={8}>
                  Totals (filtered)
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatCurrency(footerTotals.totalAmount)}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatCurrency(footerTotals.balance)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    </div>
  );
}

interface RowProps {
  row: InvoiceRow;
  now: number;
  onView: (invoiceId: Id<"invoices">) => void;
  onSend: (invoiceId: Id<"invoices">) => void;
  onDownloadPdf: (invoiceId: Id<"invoices">) => void;
  onVoid: (invoiceId: Id<"invoices">, invoiceNumber: string) => void;
  isSelected: boolean;
  onToggle: (invoiceId: Id<"invoices">) => void;
}

function InvoiceTableRow({
  row,
  now,
  onView,
  onSend,
  onDownloadPdf,
  onVoid,
  isSelected,
  onToggle,
}: RowProps) {
  const dueRed = shouldRenderDueDateRed(row.status, row.dueDate, now);
  const voidDisabled = shouldDisableVoid(row.status);

  return (
    <TableRow className={cn(isSelected && "bg-green-50 hover:bg-green-50")}>
      <TableCell
        className="pl-4"
        // Stop propagation so the checkbox click never bubbles to a future
        // row click handler. Cheap to leave in even before such a handler
        // exists.
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle(row._id)}
          aria-label={`Select invoice ${row.invoiceNumber}`}
          data-testid={`invoice-row-checkbox-${row._id}`}
        />
      </TableCell>
      <TableCell className="font-mono text-sm">{row.invoiceNumber}</TableCell>
      <TableCell>
        <div className="min-w-[140px]">
          <p className="text-sm font-medium text-gray-900">{row.studentName}</p>
          <p className="text-xs text-muted-foreground">{row.studentNumber}</p>
        </div>
      </TableCell>
      <TableCell className="text-sm">{row.standardLevelName}</TableCell>
      <TableCell className="text-sm">{row.campusName}</TableCell>
      <TableCell className="whitespace-nowrap text-sm">
        {fmtDayMonthYear(row.issueDate)}
      </TableCell>
      <TableCell
        className={`whitespace-nowrap text-sm ${
          dueRed ? "font-medium text-red-600" : ""
        }`}
        data-overdue={dueRed}
      >
        {fmtDayMonthYear(row.dueDate)}
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${formatStatusBadgeClass(
            row.status,
          )}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${formatStatusDotClass(
              row.status,
            )}`}
            aria-hidden="true"
          />
          {formatStatusLabel(row.status)}
        </span>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatCurrency(row.totalAmount)}
      </TableCell>
      <TableCell
        className={`text-right tabular-nums ${
          row.balance > 0
            ? "font-medium text-gray-900"
            : "text-muted-foreground"
        }`}
      >
        {formatCurrency(row.balance)}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Open actions for invoice ${row.invoiceNumber}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onView(row._id)}>
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" /> View
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled
              title="Available after invoice editing slice"
            >
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSend(row._id)}>
              <Send className="mr-2 h-4 w-4" aria-hidden="true" /> Send to
              Parent
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownloadPdf(row._id)}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Download
              PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={voidDisabled}
              onClick={() => onVoid(row._id, row.invoiceNumber)}
              className="text-red-600 focus:text-red-600 data-[disabled]:text-muted-foreground"
              title={
                voidDisabled
                  ? "Paid and voided invoices cannot be voided"
                  : undefined
              }
            >
              <X className="mr-2 h-4 w-4" aria-hidden="true" /> Void Invoice
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────

export function InvoiceTableSkeleton() {
  return (
    <div className="rounded-lg border bg-white">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-10 pl-4">
                <Skeleton className="h-4 w-4 rounded" />
              </TableHead>
              <TableHead className="min-w-[140px]">Invoice #</TableHead>
              <TableHead className="min-w-[180px]">Student</TableHead>
              <TableHead className="min-w-[100px]">Class</TableHead>
              <TableHead className="min-w-[120px]">Campus</TableHead>
              <TableHead className="min-w-[110px]">Issue Date</TableHead>
              <TableHead className="min-w-[110px]">Due Date</TableHead>
              <TableHead className="min-w-[110px]">Status</TableHead>
              <TableHead className="min-w-[110px] text-right">Total</TableHead>
              <TableHead className="min-w-[110px] text-right">
                Balance
              </TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }, (_, i) => `sk-${i}`).map((key) => (
              <TableRow key={key}>
                <TableCell className="pl-4">
                  <Skeleton className="h-4 w-4 rounded" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-36" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-20" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ml-auto h-8 w-8 rounded" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
