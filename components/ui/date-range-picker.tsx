"use client";

import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
  subQuarters,
} from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const PRESETS = [
  "Today",
  "This Week",
  "This Month",
  "Last Month",
  "This Quarter",
  "Last Quarter",
  "This Half",
  "Full Year",
  "All Time",
] as const;

type PresetLabel = (typeof PRESETS)[number];

/**
 * Pure function: given a preset label, return the computed { from, to } date range.
 */
export function getPresetRange(label: string): { from: Date; to: Date } {
  const now = new Date();

  switch (label) {
    case "Today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "This Week":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "This Month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "Last Month": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case "This Quarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "Last Quarter": {
      const lastQuarter = subQuarters(now, 1);
      return {
        from: startOfQuarter(lastQuarter),
        to: endOfQuarter(lastQuarter),
      };
    }
    case "This Half": {
      const month = now.getMonth();
      const year = now.getFullYear();
      if (month < 6) {
        return {
          from: new Date(year, 0, 1),
          to: new Date(year, 5, 30, 23, 59, 59, 999),
        };
      }
      return {
        from: new Date(year, 6, 1),
        to: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    }
    case "Full Year":
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

interface DateRangePickerProps {
  dateRange: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange: (range: {
    from: Date | undefined;
    to: Date | undefined;
  }) => void;
  presetLabel: string | null;
  onPresetSelect: (label: string, range: { from: Date; to: Date }) => void;
  onClear: () => void;
  className?: string;
}

function formatTriggerLabel(
  presetLabel: string | null,
  dateRange: { from: Date | undefined; to: Date | undefined },
): string {
  if (presetLabel) {
    return presetLabel;
  }
  if (dateRange.from && dateRange.to) {
    return `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`;
  }
  if (dateRange.from) {
    return `${format(dateRange.from, "MMM d, yyyy")} – ...`;
  }
  return "All Time";
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  presetLabel,
  onPresetSelect,
  onClear,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const triggerLabel = formatTriggerLabel(presetLabel, dateRange);

  function handlePresetClick(label: PresetLabel) {
    if (label === "All Time") {
      onClear();
      setOpen(false);
      return;
    }
    const range = getPresetRange(label);
    onPresetSelect(label, range);
    setOpen(false);
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    if (!range) {
      onDateRangeChange({ from: undefined, to: undefined });
      return;
    }
    onDateRangeChange({ from: range.from, to: range.to });
    // Close popover only when both from and to are selected
    if (range.from && range.to) {
      setOpen(false);
    }
  }

  const calendarSelected: DateRange | undefined =
    dateRange.from || dateRange.to
      ? { from: dateRange.from, to: dateRange.to }
      : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !dateRange.from && !presetLabel && "text-muted-foreground",
            className,
          )}
          aria-label="Select date range"
        >
          <CalendarIcon data-icon="inline-start" />
          <span className="truncate">{triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-auto p-0",
          isDesktop ? "min-w-[560px]" : "min-w-[300px]",
        )}
        align="start"
      >
        <div className={cn("flex", isDesktop ? "flex-row" : "flex-col")}>
          {/* Preset sidebar (desktop) / horizontal scroll (mobile) */}
          <div
            className={cn(
              isDesktop
                ? "flex w-[160px] flex-col gap-1 border-r p-3"
                : "flex gap-1 overflow-x-auto border-b p-3",
            )}
          >
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                variant="ghost"
                size="sm"
                className={cn(
                  "justify-start whitespace-nowrap",
                  presetLabel === preset &&
                    "bg-school-green/10 font-medium text-school-green",
                  !isDesktop && "shrink-0",
                )}
                onClick={() => handlePresetClick(preset)}
                aria-label={`Select ${preset} date range`}
                aria-pressed={presetLabel === preset}
              >
                {preset}
              </Button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={calendarSelected}
              onSelect={handleCalendarSelect}
              numberOfMonths={isDesktop ? 2 : 1}
              defaultMonth={dateRange.from ?? new Date()}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
