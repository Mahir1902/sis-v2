"use client";

// PROTOTYPE — Variant B: Status-tabbed list + contextual actions + payment progress
// Left: tabs filter by status; list items show urgency signals.
// Right: document with status-aware action bar, progress bar, and activity log.

import { useState } from "react";
import {
  Search,
  Download,
  Send,
  Printer,
  MessageCircle,
  Bell,
  CheckCircle,
  Clock,
  AlertCircle,
  FileEdit,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MOCK_INVOICES,
  STATUS_CONFIG,
  fmt,
  fmtDate,
  type Invoice,
  type InvoiceStatus,
} from "./mock-data";

const TABS: { key: InvoiceStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "sent", label: "Sent" },
  { key: "draft", label: "Draft" },
  { key: "paid", label: "Paid" },
];

function urgencyLine(inv: Invoice): { text: string; color: string } {
  if (inv.status === "paid")
    return {
      text: `Paid on ${fmtDate(inv.issueDate)}`,
      color: "text-green-600",
    };
  if (inv.status === "draft")
    return { text: "Not yet sent", color: "text-gray-400" };
  const due = new Date(inv.dueDate);
  const today = new Date("2025-05-22");
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)
    return { text: `${Math.abs(diff)} days overdue`, color: "text-red-600" };
  if (diff === 0) return { text: "Due today", color: "text-orange-600" };
  return { text: `Due in ${diff} days`, color: "text-blue-600" };
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

function PaymentBar({ inv }: { inv: Invoice }) {
  const pct =
    inv.total > 0 ? Math.round((inv.paidAmount / inv.total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{pct}% paid</span>
        <span>{fmt(inv.total - inv.paidAmount)} remaining</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div
          className={`h-1.5 rounded-full transition-all ${pct === 100 ? "bg-green-500" : pct > 0 ? "bg-school-yellow" : "bg-gray-200"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const ACTIVITY: Record<
  string,
  { icon: React.ReactNode; text: string; time: string }[]
> = {
  "1": [
    {
      icon: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
      text: "Payment recorded — ₦48,500",
      time: "14/05/2025",
    },
    {
      icon: <Send className="h-3.5 w-3.5 text-blue-500" />,
      text: "Invoice sent to parent",
      time: "01/05/2025",
    },
    {
      icon: <FileEdit className="h-3.5 w-3.5 text-gray-400" />,
      text: "Invoice created",
      time: "01/05/2025",
    },
  ],
  "2": [
    {
      icon: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
      text: "Now overdue — 7 days",
      time: "22/05/2025",
    },
    {
      icon: <Send className="h-3.5 w-3.5 text-blue-500" />,
      text: "Invoice sent to parent",
      time: "01/05/2025",
    },
    {
      icon: <FileEdit className="h-3.5 w-3.5 text-gray-400" />,
      text: "Invoice created",
      time: "01/05/2025",
    },
  ],
  "3": [
    {
      icon: <Send className="h-3.5 w-3.5 text-blue-500" />,
      text: "Invoice sent to parent",
      time: "05/05/2025",
    },
    {
      icon: <FileEdit className="h-3.5 w-3.5 text-gray-400" />,
      text: "Invoice created",
      time: "05/05/2025",
    },
  ],
};

function contextualActions(inv: Invoice) {
  if (inv.status === "draft")
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="bg-school-green text-xs text-white hover:bg-school-green/90 gap-1.5"
        >
          <Send className="h-3.5 w-3.5" /> Send Invoice
        </Button>
        <Button size="sm" variant="outline" className="text-xs gap-1.5">
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
      </div>
    );
  if (inv.status === "sent")
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="bg-school-green text-xs text-white hover:bg-school-green/90 gap-1.5"
        >
          <CheckCircle className="h-3.5 w-3.5" /> Record Payment
        </Button>
        <Button size="sm" variant="outline" className="text-xs gap-1.5">
          <Bell className="h-3.5 w-3.5" /> Send Reminder
        </Button>
        <Button size="sm" variant="ghost" className="text-xs gap-1.5">
          <Download className="h-3.5 w-3.5" /> PDF
        </Button>
      </div>
    );
  if (inv.status === "overdue")
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="bg-red-600 text-xs text-white hover:bg-red-700 gap-1.5"
        >
          <CheckCircle className="h-3.5 w-3.5" /> Record Payment
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-200 text-xs text-red-700 gap-1.5 hover:bg-red-50"
        >
          <Bell className="h-3.5 w-3.5" /> Urgent Reminder
        </Button>
        <Button size="sm" variant="ghost" className="text-xs gap-1.5">
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </Button>
      </div>
    );
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" className="text-xs gap-1.5">
        <Download className="h-3.5 w-3.5" /> Download Receipt
      </Button>
      <Button size="sm" variant="ghost" className="text-xs gap-1.5">
        <Printer className="h-3.5 w-3.5" /> Print
      </Button>
    </div>
  );
}

function InvoiceDocument({ inv }: { inv: Invoice }) {
  const balance = inv.total - inv.paidAmount;
  const activity = ACTIVITY[inv.id] ?? [
    {
      icon: <FileEdit className="h-3.5 w-3.5 text-gray-400" />,
      text: "Invoice created",
      time: fmtDate(inv.issueDate),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          Preview
        </span>
        {contextualActions(inv)}
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Document */}
          <div className="rounded-xl border bg-white p-10 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="h-8 w-8 rounded-md bg-school-green" />
                <p className="mt-2 text-sm font-bold text-gray-900">
                  Al-Noor Islamic School
                </p>
                <p className="text-xs text-muted-foreground">
                  P.O. Box 1234, Lagos, Nigeria
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tracking-tight text-gray-900">
                  INVOICE
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {inv.number}
                </p>
                <StatusPill status={inv.status} />
              </div>
            </div>

            <Separator className="my-6" />

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
              <div className="text-right text-sm space-y-1">
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
                <span
                  className={balance > 0 ? "text-red-600" : "text-green-700"}
                >
                  {fmt(balance)}
                </span>
              </div>
            </div>

            {/* Payment progress bar */}
            <div className="mt-6">
              <PaymentBar inv={inv} />
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Thank you for your prompt payment. For queries, contact
              finance@alnoor.edu.ng
            </p>
          </div>

          {/* Activity log */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Activity
            </p>
            <div className="space-y-3">
              {activity.map((entry, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">{entry.icon}</div>
                  <p className="flex-1 text-sm text-gray-700">{entry.text}</p>
                  <span className="text-xs text-muted-foreground">
                    {entry.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VariantB() {
  const [activeTab, setActiveTab] = useState<InvoiceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(MOCK_INVOICES[1].id); // start on overdue

  const counts = TABS.reduce(
    (acc, t) => {
      acc[t.key] =
        t.key === "all"
          ? MOCK_INVOICES.length
          : MOCK_INVOICES.filter((i) => i.status === t.key).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const filtered = MOCK_INVOICES.filter((inv) => {
    const matchesTab = activeTab === "all" || inv.status === activeTab;
    const matchesSearch =
      inv.studentName.toLowerCase().includes(search.toLowerCase()) ||
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.class.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const selected =
    MOCK_INVOICES.find((inv) => inv.id === selectedId) ?? MOCK_INVOICES[0];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border bg-white shadow-sm">
      {/* Left panel */}
      <div className="flex w-80 flex-shrink-0 flex-col border-r">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Invoices</h2>
          <Button
            size="sm"
            className="h-7 bg-school-green text-xs text-white hover:bg-school-green/90"
          >
            + New
          </Button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-0.5 border-b px-2 pt-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 whitespace-nowrap rounded-t px-2.5 py-1.5 text-xs font-medium transition ${
                activeTab === tab.key
                  ? "border-b-2 border-school-green text-school-green"
                  : "text-muted-foreground hover:text-gray-700"
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    activeTab === tab.key
                      ? "bg-school-green/10 text-school-green"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="border-b px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Name, class, invoice #…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((inv) => {
            const urg = urgencyLine(inv);
            return (
              <button
                key={inv.id}
                onClick={() => setSelectedId(inv.id)}
                className={`w-full border-b px-4 py-3 text-left transition hover:bg-gray-50 ${
                  inv.id === selectedId
                    ? "border-l-2 border-l-school-green bg-green-50"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {inv.studentName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inv.number} · {inv.class}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    {fmt(inv.total)}
                  </span>
                </div>
                <p className={`mt-1 text-xs font-medium ${urg.color}`}>
                  {urg.text}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-hidden">
        <InvoiceDocument inv={selected} />
      </div>
    </div>
  );
}
