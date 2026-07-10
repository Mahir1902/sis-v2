"use client";

import { useQuery } from "convex/react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ReceiptStatusFilter } from "@/hooks/use-receipts-filters";
import { cn } from "@/lib/utils";

export interface ReceiptsFiltersProps {
  dateFrom: string;
  dateTo: string;
  studentId: Id<"students"> | undefined;
  studentLabel: string;
  status: ReceiptStatusFilter;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onStudentSelect: (
    studentId: Id<"students"> | undefined,
    label: string,
  ) => void;
  onStatusChange: (value: ReceiptStatusFilter) => void;
  onReset: () => void;
}

export function ReceiptsFilters({
  dateFrom,
  dateTo,
  studentId,
  studentLabel,
  status,
  onDateFromChange,
  onDateToChange,
  onStudentSelect,
  onStatusChange,
  onReset,
}: ReceiptsFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border bg-white p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="receipts-from" className="text-xs text-gray-500">
          From
        </Label>
        <Input
          id="receipts-from"
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-[150px]"
          aria-label="Filter receipts from date"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="receipts-to" className="text-xs text-gray-500">
          To
        </Label>
        <Input
          id="receipts-to"
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-[150px]"
          aria-label="Filter receipts to date"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Student</Label>
        <StudentPicker
          selectedId={studentId}
          selectedLabel={studentLabel}
          onSelect={onStudentSelect}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="receipts-status" className="text-xs text-gray-500">
          Status
        </Label>
        <Select
          value={status}
          onValueChange={(value) =>
            onStatusChange(value as ReceiptStatusFilter)
          }
        >
          <SelectTrigger
            id="receipts-status"
            className="w-[140px]"
            aria-label="Filter by receipt status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="text-gray-600"
        aria-label="Reset receipt filters"
      >
        <X className="mr-1 h-4 w-4" aria-hidden />
        Reset
      </Button>
    </div>
  );
}

function StudentPicker({
  selectedId,
  selectedLabel,
  onSelect,
}: {
  selectedId: Id<"students"> | undefined;
  selectedLabel: string;
  onSelect: (studentId: Id<"students"> | undefined, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const results = useQuery(
    api.transactionLog.searchStudents,
    searchQuery.trim().length >= 2 ? { nameQuery: searchQuery } : "skip",
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label="Select student to filter receipts"
          className={cn(
            "w-[220px] justify-between font-normal",
            !selectedId && "text-gray-500",
          )}
        >
          <span className="truncate">
            {selectedId ? selectedLabel : "All students"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by student name..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {searchQuery.trim().length < 2 ? (
              <CommandEmpty>Type at least 2 characters.</CommandEmpty>
            ) : results === undefined ? (
              <CommandEmpty>Searching...</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>No students found.</CommandEmpty>
            ) : (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onSelect(undefined, "");
                    setOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !selectedId ? "opacity-100" : "opacity-0",
                    )}
                  />
                  All students
                </CommandItem>
                {results.map((s) => (
                  <CommandItem
                    key={s._id}
                    onSelect={() => {
                      onSelect(
                        s._id,
                        `${s.studentFullName} (${s.studentNumber})`,
                      );
                      setOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedId === s._id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm">{s.studentFullName}</span>
                      <span className="text-xs text-gray-500">
                        {s.studentNumber}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
