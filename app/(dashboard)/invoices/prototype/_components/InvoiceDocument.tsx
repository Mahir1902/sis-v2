"use client";

// PROTOTYPE — Shared invoice document component used by Variant A and Variant C.

import { Download, Send, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { STATUS_CONFIG, fmt, fmtDate, type Invoice } from "./mock-data";

function StatusBadge({ status }: { status: Invoice["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

export function InvoiceDocument({
  inv,
  onClose,
}: {
  inv: Invoice;
  onClose?: () => void;
}) {
  const balance = inv.total - inv.paidAmount;
  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-gray-100 hover:text-gray-900"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="text-sm font-medium text-muted-foreground">
            Preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-school-green text-xs text-white hover:bg-school-green/90"
          >
            <Send className="h-3.5 w-3.5" /> Send to Parent
          </Button>
        </div>
      </div>

      {/* Document */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl rounded-xl border bg-white p-10 shadow-sm">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/SIS_Logo.svg"
                alt="School logo"
                className="h-14 w-14 object-contain"
              />
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Al-Noor Islamic School
                </p>
                <p className="text-xs text-muted-foreground">
                  P.O. Box 1234, Lagos, Nigeria
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tracking-tight text-gray-900">
                INVOICE
              </p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {inv.number}
              </p>
              <div className="mt-1">
                <StatusBadge status={inv.status} />
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Bill to + dates */}
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Bill To
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {inv.studentName}
              </p>
              <p className="text-muted-foreground">
                {inv.studentId} · {inv.class}
              </p>
              <p className="text-muted-foreground">{inv.campus}</p>
            </div>
            <div className="text-right space-y-1">
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">Issue Date</span>
                <span className="font-medium">{fmtDate(inv.issueDate)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">Due Date</span>
                <span
                  className={`font-medium ${inv.status === "overdue" ? "text-red-600" : ""}`}
                >
                  {fmtDate(inv.dueDate)}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Line items */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="pb-2 text-left">Description</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item, i) => (
                <tr key={i} className="border-t">
                  <td className="py-3 text-gray-700">{item.description}</td>
                  <td className="py-3 text-right font-medium">
                    {fmt(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Separator className="my-4" />

          {/* Totals */}
          <div className="ml-auto w-56 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{fmt(inv.total)}</span>
            </div>
            {inv.paidAmount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Paid</span>
                <span>– {fmt(inv.paidAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Balance Due</span>
              <span className={balance > 0 ? "text-red-600" : "text-green-700"}>
                {fmt(balance)}
              </span>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Thank you for your prompt payment. For queries, contact
            finance@alnoor.edu.ng
          </p>
        </div>
      </div>
    </div>
  );
}
