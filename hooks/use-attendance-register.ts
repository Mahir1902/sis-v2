"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  type AttendanceStatus,
  nextStatus,
  saveButtonLabel,
  tally,
} from "@/lib/attendanceView";

interface RegisterStudent {
  studentId: Id<"students">;
  studentName: string;
  studentNumber: string;
  status: AttendanceStatus | null;
}

/**
 * Local tap state for the daily register (spec §5.3). Everyone defaults to
 * present; a tap cycles the row. Overrides sit on top of the server's rows
 * and are dropped by `reset()` after a save or a class/date change.
 */
export function useAttendanceRegister(
  students: RegisterStudent[],
  alreadyMarked: boolean,
) {
  const [overrides, setOverrides] = useState<
    Map<Id<"students">, AttendanceStatus>
  >(new Map());

  const rows = students.map((s) => ({
    ...s,
    status: overrides.get(s.studentId) ?? s.status ?? "present",
  }));
  const touched = overrides.size > 0;
  const counts = tally(rows.map((r) => r.status));

  /** Overrides hold only real diffs, so undoing every tap reads untouched. */
  function setStatus(studentId: Id<"students">, status: AttendanceStatus) {
    const base =
      students.find((s) => s.studentId === studentId)?.status ?? "present";
    setOverrides((m) => {
      const next = new Map(m);
      if (status === base) next.delete(studentId);
      else next.set(studentId, status);
      return next;
    });
  }

  function cycle(studentId: Id<"students">) {
    const current =
      rows.find((r) => r.studentId === studentId)?.status ?? "present";
    setStatus(studentId, nextStatus(current));
  }

  function reset() {
    setOverrides(new Map());
  }

  return {
    rows,
    exceptions: rows.filter((r) => r.status !== "present"),
    touched,
    counts,
    buttonLabel: saveButtonLabel({ alreadyMarked, touched, counts }),
    cycle,
    setStatus,
    reset,
  };
}
