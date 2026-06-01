"use client";

import { Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { InvoiceStatusFilter } from "@/hooks/use-invoice-filters";

const ALL_LEVELS = "__all__";
const ALL_CAMPUSES = "__all__";
const ALL_YEARS = "__all__";

export interface StatusCounts {
  all: number;
  draft: number;
  sent: number;
  paid: number;
  overdue: number;
  voided: number;
}

interface Props {
  searchInput: string;
  onSearchChange: (value: string) => void;
  status: InvoiceStatusFilter;
  onStatusChange: (value: InvoiceStatusFilter) => void;
  statusCounts: StatusCounts | undefined;
  standardLevels: Doc<"standardLevels">[] | undefined;
  standardLevelId: Id<"standardLevels"> | undefined;
  onStandardLevelChange: (value: Id<"standardLevels"> | undefined) => void;
  campuses: Doc<"campuses">[] | undefined;
  campusId: Id<"campuses"> | undefined;
  onCampusChange: (value: Id<"campuses"> | undefined) => void;
  academicYears: Doc<"academicYears">[] | undefined;
  academicYearId: Id<"academicYears"> | undefined;
  onAcademicYearChange: (value: Id<"academicYears"> | undefined) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}

const STATUS_TABS: { key: InvoiceStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "voided", label: "Voided" },
];

/**
 * Single bordered Card row that hosts every filter for the invoice list.
 *
 * Layout (left → right): search · status tabs · class · campus · year · clear · export.
 * On mobile each row wraps; status tabs become a horizontal scroll strip.
 */
export function InvoiceFilterToolbar({
  searchInput,
  onSearchChange,
  status,
  onStatusChange,
  statusCounts,
  standardLevels,
  standardLevelId,
  onStandardLevelChange,
  campuses,
  campusId,
  onCampusChange,
  academicYears,
  academicYearId,
  onAcademicYearChange,
  hasActiveFilters,
  onClear,
}: Props) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        {/* Top row: search + selects + actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1">
            <Search
              className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, student ID, or invoice number"
              className="pl-8"
              aria-label="Search invoices"
            />
          </div>

          {/* Class (standard level) */}
          <div className="min-w-[160px] flex-1 sm:flex-none">
            <Select
              value={standardLevelId ?? ALL_LEVELS}
              onValueChange={(v) =>
                onStandardLevelChange(
                  v === ALL_LEVELS ? undefined : (v as Id<"standardLevels">),
                )
              }
            >
              <SelectTrigger aria-label="Filter by class">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LEVELS}>All classes</SelectItem>
                {standardLevels?.map((level) => (
                  <SelectItem key={level._id} value={level._id}>
                    {level.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campus */}
          <div className="min-w-[160px] flex-1 sm:flex-none">
            <Select
              value={campusId ?? ALL_CAMPUSES}
              onValueChange={(v) =>
                onCampusChange(
                  v === ALL_CAMPUSES ? undefined : (v as Id<"campuses">),
                )
              }
            >
              <SelectTrigger aria-label="Filter by campus">
                <SelectValue placeholder="All campuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CAMPUSES}>All campuses</SelectItem>
                {campuses?.map((campus) => (
                  <SelectItem key={campus._id} value={campus._id}>
                    {campus.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Academic Year */}
          <div className="min-w-[160px] flex-1 sm:flex-none">
            <Select
              value={academicYearId ?? ALL_YEARS}
              onValueChange={(v) =>
                onAcademicYearChange(
                  v === ALL_YEARS ? undefined : (v as Id<"academicYears">),
                )
              }
            >
              <SelectTrigger aria-label="Filter by academic year">
                <SelectValue placeholder="Academic year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears?.map((year) => (
                  <SelectItem key={year._id} value={year._id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-muted-foreground hover:text-gray-900"
            >
              <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Clear
            </Button>
          )}

          {/* Export CSV — disabled placeholder until #32 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Available after issue #32 wires the export"
            aria-label="Export to CSV (not yet available)"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />{" "}
            Export CSV
          </Button>
        </div>

        {/* Status tabs row — horizontal scroll on narrow screens */}
        <div
          className="flex items-center gap-1 overflow-x-auto"
          role="tablist"
          aria-label="Filter by status"
        >
          {STATUS_TABS.map((tab) => {
            const count = statusCounts?.[tab.key];
            const isActive = status === tab.key;
            return (
              <button
                type="button"
                key={tab.key}
                onClick={() => onStatusChange(tab.key)}
                role="tab"
                aria-selected={isActive}
                aria-label={
                  count !== undefined ? `${tab.label}, ${count}` : tab.label
                }
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-school-green/10 text-school-green"
                    : "text-muted-foreground hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {tab.label}
                {count !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      isActive
                        ? "bg-school-green/20 text-school-green"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
