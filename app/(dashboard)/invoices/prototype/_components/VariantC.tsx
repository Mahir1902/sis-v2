"use client";

// PROTOTYPE — Variant C: Dense power table with bulk actions and inline totals
// Filters live in a clean single-row toolbar. Bulk selection triggers a floating
// action bar above the prototype switcher — never disrupts the filter row.

import { useState } from "react";
import {
  Search,
  Trash2,
  Send,
  Download,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  MOCK_INVOICES,
  STATUS_CONFIG,
  fmt,
  fmtDate,
  type Invoice,
  type InvoiceStatus,
} from "./mock-data";
import { InvoiceDocument } from "./InvoiceDocument";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const STATUS_DOT: Record<InvoiceStatus, string> = {
  draft: "bg-gray-400",
  sent: "bg-blue-500",
  paid: "bg-green-500",
  overdue: "bg-red-500",
};

const CLASSES = [...new Set(MOCK_INVOICES.map((i) => i.class))].sort();

// Floating selection bar — appears above the prototype switcher pill
function SelectionBar({
  count,
  total,
  onClear,
}: {
  count: number;
  total: number;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-xl">
        <span className="text-sm font-semibold text-gray-900">
          {count} selected
        </span>
        <span className="text-sm text-muted-foreground">· {fmt(total)}</span>
        <div className="mx-1 h-4 w-px bg-gray-200" />
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
          <Send className="h-3.5 w-3.5" /> Send
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> PDF
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" /> Void
        </Button>
        <div className="mx-1 h-4 w-px bg-gray-200" />
        <button
          onClick={onClear}
          className="text-muted-foreground hover:text-gray-700"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function VariantC() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">(
    "all",
  );
  const [classFilter, setClassFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  const filtered = MOCK_INVOICES.filter((inv) => {
    const matchesSearch =
      inv.studentName.toLowerCase().includes(search.toLowerCase()) ||
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.class.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesClass = classFilter === "all" || inv.class === classFilter;
    return matchesSearch && matchesStatus && matchesClass;
  });

  const allSelected =
    filtered.length > 0 && filtered.every((inv) => selected.has(inv.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const n = new Set(prev);
        filtered.forEach((i) => n.delete(i.id));
        return n;
      });
    } else {
      setSelected((prev) => {
        const n = new Set(prev);
        filtered.forEach((i) => n.add(i.id));
        return n;
      });
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selectedInvoices = MOCK_INVOICES.filter((inv) => selected.has(inv.id));
  const selectedTotal = selectedInvoices.reduce((s, inv) => s + inv.total, 0);
  const filteredTotal = filtered.reduce((s, inv) => s + inv.total, 0);
  const filteredPaid = filtered
    .filter((inv) => inv.status === "paid")
    .reduce((s, inv) => s + inv.total, 0);
  const filteredBalance = filteredTotal - filteredPaid;

  const hasFilters =
    statusFilter !== "all" || classFilter !== "all" || search.trim() !== "";

  return (
    <div className="flex flex-col gap-5 pb-32">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Term 2 · 2024–2025</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button
            size="sm"
            className="bg-school-green text-white hover:bg-school-green/90"
          >
            + Generate Invoice
          </Button>
        </div>
      </div>

      {/* Filter toolbar — single clean row */}
      <div className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, class, invoice #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>

        <div className="h-5 w-px bg-gray-200" />

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as InvoiceStatus | "all")}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>

        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {CLASSES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <>
            <div className="h-5 w-px bg-gray-200" />
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setClassFilter("all");
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Total Invoiced",
            value: fmt(filteredTotal),
            sub: `${filtered.length} invoices`,
          },
          {
            label: "Collected",
            value: fmt(filteredPaid),
            sub: `${filtered.filter((i) => i.status === "paid").length} paid`,
            color: "text-green-700",
          },
          {
            label: "Outstanding",
            value: fmt(filteredBalance),
            sub: `${filtered.filter((i) => i.status !== "paid").length} unpaid`,
            color: filteredBalance > 0 ? "text-red-600" : "text-green-700",
          },
          {
            label: "Overdue",
            value: fmt(
              filtered
                .filter((i) => i.status === "overdue")
                .reduce((s, i) => s + i.total, 0),
            ),
            sub: `${filtered.filter((i) => i.status === "overdue").length} overdue`,
            color: "text-red-600",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {s.label}
            </p>
            <p
              className={`mt-0.5 text-xl font-bold ${s.color ?? "text-gray-900"}`}
            >
              {s.value}
            </p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Invoice #
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Student
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Class
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Campus
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Issue Date
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Due Date
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Status
              </TableHead>
              <TableHead className="text-right font-semibold text-gray-700">
                Total
              </TableHead>
              <TableHead className="text-right font-semibold text-gray-700">
                Balance
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => {
              const balance = inv.total - inv.paidAmount;
              const isSelected = selected.has(inv.id);
              return (
                <TableRow
                  key={inv.id}
                  className={`cursor-pointer text-sm transition ${isSelected ? "bg-green-50 hover:bg-green-50" : "hover:bg-gray-50"}`}
                  onClick={() => toggle(inv.id)}
                >
                  <TableCell
                    className="pl-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(inv.id)}
                      aria-label={`Select ${inv.number}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium text-blue-700">
                    {inv.number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{inv.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.studentId}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {inv.class}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {inv.campus}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(inv.issueDate)}
                  </TableCell>
                  <TableCell
                    className={
                      inv.status === "overdue"
                        ? "font-medium text-red-600"
                        : "text-muted-foreground"
                    }
                  >
                    {fmtDate(inv.dueDate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${STATUS_DOT[inv.status]}`}
                      />
                      <span
                        className={`text-xs font-medium ${STATUS_CONFIG[inv.status].color}`}
                      >
                        {STATUS_CONFIG[inv.status].label}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {fmt(inv.total)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${balance > 0 ? "text-red-600" : "text-green-700"}`}
                  >
                    {fmt(balance)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Invoice actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-sm">
                        <DropdownMenuItem onClick={() => setViewInvoice(inv)}>
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Send to Parent</DropdownMenuItem>
                        <DropdownMenuItem>Download PDF</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          Void Invoice
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-gray-50 font-semibold text-sm">
              <TableCell colSpan={8} className="pl-4 text-muted-foreground">
                {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
              </TableCell>
              <TableCell className="text-right">{fmt(filteredTotal)}</TableCell>
              <TableCell
                className={`text-right ${filteredBalance > 0 ? "text-red-600" : "text-green-700"}`}
              >
                {fmt(filteredBalance)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Floating selection bar */}
      <SelectionBar
        count={selected.size}
        total={selectedTotal}
        onClear={() => setSelected(new Set())}
      />

      {/* Invoice preview sheet */}
      <Sheet
        open={viewInvoice !== null}
        onOpenChange={(open) => {
          if (!open) setViewInvoice(null);
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full max-w-2xl p-0 sm:max-w-2xl"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{viewInvoice?.number ?? "Invoice"}</SheetTitle>
          </SheetHeader>
          {viewInvoice && (
            <InvoiceDocument
              inv={viewInvoice}
              onClose={() => setViewInvoice(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
