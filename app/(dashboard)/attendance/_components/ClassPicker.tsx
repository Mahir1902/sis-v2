"use client";

import { AcademicYearSelect } from "@/components/shared/AcademicYearSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Id } from "@/convex/_generated/dataModel";
import type { useAttendanceClass } from "@/hooks/use-attendance-class";

type Picker = ReturnType<typeof useAttendanceClass>;

/**
 * Class · Campus · Year selects for the register unit (spec §5.3). Campus is
 * a required second select because #120 is real. Renders as one aligned
 * toolbar row; the caller places it on the card's top edge.
 */
export function ClassPicker({
  picker,
  idPrefix,
}: {
  picker: Picker;
  idPrefix: string;
}) {
  const { campuses, levels, years, selection, update } = picker;
  return (
    <div className="flex flex-wrap gap-2">
      <Select
        value={selection.standardLevelId ?? ""}
        onValueChange={(v) =>
          update({ standardLevelId: v as Id<"standardLevels"> })
        }
      >
        <SelectTrigger
          id={`${idPrefix}-level`}
          aria-label="Select class"
          className="w-[calc(50%-0.25rem)] sm:w-36"
        >
          <SelectValue placeholder="Class" />
        </SelectTrigger>
        <SelectContent>
          {levels?.map((l) => (
            <SelectItem key={l._id} value={l._id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={selection.campus ?? ""}
        onValueChange={(v) => update({ campus: v as Id<"campuses"> })}
      >
        <SelectTrigger
          id={`${idPrefix}-campus`}
          aria-label="Select campus"
          className="w-[calc(50%-0.25rem)] sm:w-40"
        >
          <SelectValue placeholder="Campus" />
        </SelectTrigger>
        <SelectContent>
          {campuses?.map((c) => (
            <SelectItem key={c._id} value={c._id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <AcademicYearSelect
        id={`${idPrefix}-year`}
        years={years}
        value={selection.academicYear}
        onChange={(academicYear) => update({ academicYear })}
        className="w-full sm:w-32"
      />
    </div>
  );
}
