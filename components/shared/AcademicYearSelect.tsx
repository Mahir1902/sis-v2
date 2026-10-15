"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Id } from "@/convex/_generated/dataModel";

interface AcademicYearSelectProps {
  id: string;
  years: { _id: Id<"academicYears">; name: string }[] | undefined;
  value: Id<"academicYears"> | undefined;
  onChange: (id: Id<"academicYears">) => void;
  className?: string;
}

/** One academic-year dropdown shared by the attendance and calendar screens. */
export function AcademicYearSelect({
  id,
  years,
  value,
  onChange,
  className,
}: AcademicYearSelectProps) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => onChange(v as Id<"academicYears">)}
    >
      <SelectTrigger
        id={id}
        aria-label="Select academic year"
        className={className}
      >
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent>
        {years?.map((y) => (
          <SelectItem key={y._id} value={y._id}>
            {y.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
