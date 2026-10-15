"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { currentYear } from "@/lib/attendanceView";

export interface ClassKey {
  campus: Id<"campuses">;
  standardLevelId: Id<"standardLevels">;
  academicYear: Id<"academicYears">;
}

const STORAGE_KEY = "attendance.lastClass";

/**
 * The register unit (campus, level, year) chosen on the attendance screens.
 * The last campus and level are remembered in localStorage and restored on
 * open (spec §5.3); the year always defaults to the one containing today.
 */
export function useAttendanceClass() {
  const campuses = useQuery(api.campus.list);
  const levels = useQuery(api.standardLevels.list);
  const years = useQuery(api.academicYears.list);
  const [selection, setSelection] = useState<Partial<ClassKey>>({});
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { campus, standardLevelId } = JSON.parse(
          saved,
        ) as Partial<ClassKey>;
        setSelection({ campus, standardLevelId });
      }
    } catch {
      // ponytail: a corrupt entry just means "nothing remembered"
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored || selection.academicYear || !years) return;
    const year = currentYear(years);
    if (year) setSelection((s) => ({ ...s, academicYear: year._id }));
  }, [restored, selection.academicYear, years]);

  function update(patch: Partial<ClassKey>) {
    setSelection((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            campus: next.campus,
            standardLevelId: next.standardLevelId,
          }),
        );
      } catch {
        // storage unavailable — selection still works for this visit
      }
      return next;
    });
  }

  const classKey: ClassKey | null =
    selection.campus && selection.standardLevelId && selection.academicYear
      ? (selection as ClassKey)
      : null;

  return { campuses, levels, years, selection, update, classKey };
}
