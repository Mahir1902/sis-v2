"use client";

import { useQuery } from "convex/react";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const PAYMENT_MODES = [
  "Cash",
  "Bank Transfer",
  "Cheque",
  "UPI",
  "Online",
] as const;

interface TransactionFiltersProps {
  academicYears: Array<{ _id: Id<"academicYears">; name: string }>;
  effectiveYearId: Id<"academicYears"> | undefined;
  onYearChange: (id: Id<"academicYears">) => void;

  standardLevelId: Id<"standardLevels"> | undefined;
  onStandardLevelChange: (id: Id<"standardLevels"> | undefined) => void;

  dateRange: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange: (range: {
    from: Date | undefined;
    to: Date | undefined;
  }) => void;
  datePresetLabel: string | null;
  onPresetSelect: (label: string, range: { from: Date; to: Date }) => void;
  onDateClear: () => void;

  studentIds: Id<"students">[] | undefined;
  onStudentIdsChange: (ids: Id<"students">[] | undefined) => void;

  campusFilter: Id<"campuses"> | undefined;
  onCampusChange: (campus: Id<"campuses"> | undefined) => void;
  paymentMode: string | undefined;
  onPaymentModeChange: (mode: string | undefined) => void;
  includeVoided: boolean;
  onIncludeVoidedChange: (val: boolean) => void;

  hasActiveFilters: boolean;
  onReset: () => void;
}

export function TransactionFilters({
  academicYears,
  effectiveYearId,
  onYearChange,
  standardLevelId,
  onStandardLevelChange,
  dateRange,
  onDateRangeChange,
  datePresetLabel,
  onPresetSelect,
  onDateClear,
  studentIds,
  onStudentIdsChange,
  campusFilter,
  onCampusChange,
  paymentMode,
  onPaymentModeChange,
  includeVoided,
  onIncludeVoidedChange,
  hasActiveFilters,
  onReset,
}: TransactionFiltersProps) {
  const campuses = useQuery(api.campus.list);
  const standardLevels = useQuery(api.standardLevels.list);

  const [showSecondary, setShowSecondary] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Count active secondary filters (campus, payment mode, voided)
  const secondaryActiveCount = [
    campusFilter !== undefined,
    paymentMode !== undefined,
    includeVoided,
  ].filter(Boolean).length;

  // Count all active filters for mobile badge (excludes academic year — always set)
  const totalActiveCount = [
    dateRange.from !== undefined || dateRange.to !== undefined,
    campusFilter !== undefined,
    paymentMode !== undefined,
    includeVoided,
    studentIds !== undefined && studentIds.length > 0,
    standardLevelId !== undefined,
  ].filter(Boolean).length;

  // Auto-expand secondary row when secondary filters become active
  useEffect(() => {
    if (secondaryActiveCount > 0) {
      setShowSecondary(true);
    }
  }, [secondaryActiveCount]);

  function handleMobileReset() {
    onReset();
    setMobileOpen(false);
  }

  return (
    <section aria-label="Transaction filters">
      {/* Desktop layout */}
      <div className="hidden sm:block rounded-lg border bg-white p-4 space-y-3">
        {/* Primary row */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Academic Year */}
          <div className="space-y-1.5 w-[160px]">
            <Label htmlFor="year-filter">Academic Year</Label>
            <Select
              value={effectiveYearId}
              onValueChange={(val) => onYearChange(val as Id<"academicYears">)}
            >
              <SelectTrigger
                id="year-filter"
                aria-label="Filter by academic year"
              >
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y._id} value={y._id}>
                    {y.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Standard Level */}
          <div className="space-y-1.5 w-[150px]">
            <Label htmlFor="level-filter">Standard Level</Label>
            <Select
              value={standardLevelId ?? "__all__"}
              onValueChange={(val) =>
                onStandardLevelChange(
                  val === "__all__" ? undefined : (val as Id<"standardLevels">),
                )
              }
            >
              <SelectTrigger
                id="level-filter"
                aria-label="Filter by standard level"
              >
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Levels</SelectItem>
                {standardLevels?.map((l) => (
                  <SelectItem key={l._id} value={l._id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Picker */}
          <div className="space-y-1.5 min-w-[180px]">
            <Label>Date Range</Label>
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={onDateRangeChange}
              presetLabel={datePresetLabel}
              onPresetSelect={onPresetSelect}
              onClear={onDateClear}
              className="w-full"
            />
          </div>

          {/* Student Search */}
          <div className="space-y-1.5 min-w-[200px] flex-1">
            <Label>Student</Label>
            <StudentSearch
              selectedIds={studentIds}
              onSelectionChange={onStudentIdsChange}
            />
          </div>

          {/* More Filters + Reset */}
          <div className="flex items-end gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSecondary((s) => !s)}
              aria-expanded={showSecondary}
              aria-label="Show more filters"
            >
              <SlidersHorizontal data-icon="inline-start" />
              More Filters
              {secondaryActiveCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-5 min-w-5 px-1.5 text-xs"
                >
                  {secondaryActiveCount}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={!hasActiveFilters}
              aria-label="Reset all filters"
              className="text-muted-foreground"
            >
              <RotateCcw data-icon="inline-start" />
              Reset
            </Button>
          </div>
        </div>

        {/* Secondary row - animated expand/collapse */}
        <div
          className={cn(
            "grid overflow-hidden transition-all duration-200 ease-in-out",
            showSecondary
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-wrap items-end gap-3 pt-3 border-t">
              {/* Campus */}
              <div className="space-y-1.5 w-[160px]">
                <Label htmlFor="campus-filter">Campus</Label>
                <Select
                  value={campusFilter ?? "__all__"}
                  onValueChange={(val) =>
                    onCampusChange(
                      val === "__all__" ? undefined : (val as Id<"campuses">),
                    )
                  }
                >
                  <SelectTrigger
                    id="campus-filter"
                    aria-label="Filter by campus"
                  >
                    <SelectValue placeholder="All Campuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Campuses</SelectItem>
                    {campuses?.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Mode */}
              <div className="space-y-1.5 w-[160px]">
                <Label htmlFor="payment-filter">Payment Mode</Label>
                <Select
                  value={paymentMode ?? "__all__"}
                  onValueChange={(val) =>
                    onPaymentModeChange(val === "__all__" ? undefined : val)
                  }
                >
                  <SelectTrigger
                    id="payment-filter"
                    aria-label="Filter by payment mode"
                  >
                    <SelectValue placeholder="All Modes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Modes</SelectItem>
                    {PAYMENT_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Show Voided toggle */}
              <div className="flex items-center gap-2 pb-0.5">
                <Switch
                  id="voided-toggle"
                  checked={includeVoided}
                  onCheckedChange={onIncludeVoidedChange}
                  aria-label="Show voided sessions"
                />
                <Label
                  htmlFor="voided-toggle"
                  className="cursor-pointer text-sm"
                >
                  Show Voided
                </Label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="block sm:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              aria-label="Open transaction filters"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4" />
                Filters
              </span>
              {totalActiveCount > 0 && (
                <Badge variant="secondary">{totalActiveCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85vh] overflow-y-auto rounded-t-xl"
          >
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4 py-4">
              {/* Academic Year */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mobile-year-filter">Academic Year</Label>
                <Select
                  value={effectiveYearId}
                  onValueChange={(val) =>
                    onYearChange(val as Id<"academicYears">)
                  }
                >
                  <SelectTrigger
                    id="mobile-year-filter"
                    className="w-full"
                    aria-label="Filter by academic year"
                  >
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((y) => (
                      <SelectItem key={y._id} value={y._id}>
                        {y.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Standard Level */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mobile-level-filter">Standard Level</Label>
                <Select
                  value={standardLevelId ?? "__all__"}
                  onValueChange={(val) =>
                    onStandardLevelChange(
                      val === "__all__"
                        ? undefined
                        : (val as Id<"standardLevels">),
                    )
                  }
                >
                  <SelectTrigger
                    id="mobile-level-filter"
                    className="w-full"
                    aria-label="Filter by standard level"
                  >
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Levels</SelectItem>
                    {standardLevels?.map((l) => (
                      <SelectItem key={l._id} value={l._id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="flex flex-col gap-1.5">
                <Label>Date Range</Label>
                <DateRangePicker
                  dateRange={dateRange}
                  onDateRangeChange={onDateRangeChange}
                  presetLabel={datePresetLabel}
                  onPresetSelect={onPresetSelect}
                  onClear={onDateClear}
                  className="w-full"
                />
              </div>

              {/* Student Search */}
              <div className="flex flex-col gap-1.5">
                <Label>Student</Label>
                <StudentSearch
                  selectedIds={studentIds}
                  onSelectionChange={onStudentIdsChange}
                />
              </div>

              {/* Campus */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mobile-campus-filter">Campus</Label>
                <Select
                  value={campusFilter ?? "__all__"}
                  onValueChange={(val) =>
                    onCampusChange(
                      val === "__all__" ? undefined : (val as Id<"campuses">),
                    )
                  }
                >
                  <SelectTrigger
                    id="mobile-campus-filter"
                    className="w-full"
                    aria-label="Filter by campus"
                  >
                    <SelectValue placeholder="All Campuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Campuses</SelectItem>
                    {campuses?.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Mode */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mobile-payment-filter">Payment Mode</Label>
                <Select
                  value={paymentMode ?? "__all__"}
                  onValueChange={(val) =>
                    onPaymentModeChange(val === "__all__" ? undefined : val)
                  }
                >
                  <SelectTrigger
                    id="mobile-payment-filter"
                    className="w-full"
                    aria-label="Filter by payment mode"
                  >
                    <SelectValue placeholder="All Modes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Modes</SelectItem>
                    {PAYMENT_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Show Voided toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="mobile-voided-toggle"
                  checked={includeVoided}
                  onCheckedChange={onIncludeVoidedChange}
                  aria-label="Show voided sessions"
                />
                <Label
                  htmlFor="mobile-voided-toggle"
                  className="cursor-pointer text-sm"
                >
                  Show Voided
                </Label>
              </div>
            </div>

            {/* Sheet footer */}
            <div className="flex gap-2 border-t px-4 pt-4 pb-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleMobileReset}
                disabled={!hasActiveFilters}
                aria-label="Reset all filters"
              >
                <RotateCcw data-icon="inline-start" />
                Reset
              </Button>
              <Button
                className="flex-1 bg-school-green hover:bg-school-green/90"
                onClick={() => setMobileOpen(false)}
                aria-label="Apply filters and close"
              >
                Apply
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </section>
  );
}

// -- StudentSearch sub-component -------------------------------------------

function StudentSearch({
  selectedIds,
  onSelectionChange,
}: {
  selectedIds: Id<"students">[] | undefined;
  onSelectionChange: (ids: Id<"students">[] | undefined) => void;
}) {
  const [nameQuery, setNameQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 300ms debounce
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(nameQuery);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nameQuery]);

  const results = useQuery(
    api.transactionLog.searchStudents,
    debouncedQuery.trim().length > 0 ? { nameQuery: debouncedQuery } : "skip",
  );

  const selectedCount = selectedIds?.length ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            selectedCount === 0 && "text-muted-foreground",
          )}
          aria-label="Search and filter by student"
        >
          <Search data-icon="inline-start" />
          {selectedCount > 0
            ? `${selectedCount} student${selectedCount > 1 ? "s" : ""} selected`
            : "Search student..."}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 size-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Type student name..."
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              aria-label="Student name search"
            />
          </div>
          <CommandList>
            {selectedCount > 0 && (
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={() => {
                    onSelectionChange(undefined);
                    setNameQuery("");
                  }}
                >
                  Clear selection
                </CommandItem>
              </CommandGroup>
            )}
            {debouncedQuery.trim().length > 0 && (
              <>
                <CommandEmpty>No students found.</CommandEmpty>
                <CommandGroup heading="Results">
                  {results?.map((student) => {
                    const isSelected =
                      selectedIds?.includes(student._id) ?? false;
                    return (
                      <CommandItem
                        key={student._id}
                        onSelect={() => {
                          const current = selectedIds ?? [];
                          if (isSelected) {
                            const next = current.filter(
                              (id) => id !== student._id,
                            );
                            onSelectionChange(
                              next.length > 0 ? next : undefined,
                            );
                          } else {
                            onSelectionChange([...current, student._id]);
                          }
                        }}
                      >
                        <span
                          className={cn(
                            "mr-2 size-4 rounded border flex items-center justify-center text-xs",
                            isSelected
                              ? "bg-school-green border-school-green text-white"
                              : "border-muted-foreground/30",
                          )}
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                        <div>
                          <p className="text-sm">{student.studentFullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.studentNumber}
                          </p>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
