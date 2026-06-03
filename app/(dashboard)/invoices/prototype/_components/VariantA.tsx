"use client";

// PROTOTYPE — Variant A: Split-panel document view
// Left: status-tab filter + search + sort. Right: formatted invoice document.

import { useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MOCK_INVOICES,
  STATUS_CONFIG,
  fmt,
  type Invoice,
  type InvoiceStatus,
} from "./mock-data";
import { InvoiceDocument } from "./InvoiceDocument";

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

const STATUS_TABS: { key: InvoiceStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "sent", label: "Sent" },
  { key: "draft", label: "Draft" },
  { key: "paid", label: "Paid" },
];

type SortKey =
  | "date-desc"
  | "date-asc"
  | "amount-desc"
  | "amount-asc"
  | "name-asc";
const SORT_LABELS: Record<SortKey, string> = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
  "amount-desc": "Amount: high → low",
  "amount-asc": "Amount: low → high",
  "name-asc": "Student name",
};

export function VariantA() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<InvoiceStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [selectedId, setSelectedId] = useState(MOCK_INVOICES[0].id);

  const counts = STATUS_TABS.reduce(
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
  }).sort((a, b) => {
    if (sort === "date-desc") return b.issueDate.localeCompare(a.issueDate);
    if (sort === "date-asc") return a.issueDate.localeCompare(b.issueDate);
    if (sort === "amount-desc") return b.total - a.total;
    if (sort === "amount-asc") return a.total - b.total;
    return a.studentName.localeCompare(b.studentName);
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

        {/* Search + sort */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Name, class, invoice #…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                aria-label="Sort"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(
                ([key, label]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setSort(key)}
                    className={`text-sm ${sort === key ? "font-semibold text-school-green" : ""}`}
                  >
                    {label}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto border-b px-2 pt-1">
          {STATUS_TABS.map((tab) => (
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

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No invoices match
            </p>
          )}
          {filtered.map((inv) => (
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
                  <p className="text-xs text-muted-foreground">{inv.number}</p>
                </div>
                <StatusBadge status={inv.status} />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {inv.class}
                </span>
                <span className="text-sm font-semibold">{fmt(inv.total)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-hidden">
        <InvoiceDocument inv={selected} />
      </div>
    </div>
  );
}
